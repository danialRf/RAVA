import {
  assertOrderTransition,
  orderItemProcurementStateMachine,
  orderStateMachine,
  purchaseTaskStateMachine,
} from "@rava/domain";
import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import {
  orderItems,
  adminAuditLog,
  localDeliveries,
  orders,
  orderStatusHistory,
  outboxEvents,
  purchaseTasks,
  payments,
} from "../schema";

export class LifecycleOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LifecycleOperationError";
  }
}

function moneyOf(order: typeof orders.$inferSelect) {
  return {
    totalLockedToman: order.totalLockedToman,
    depositRequiredToman: order.depositRequiredToman,
    depositPaidToman: order.depositPaidToman,
    balanceDueToman: order.balanceDueToman,
    balancePaidToman: order.balancePaidToman,
  };
}

function requiredText(value: string | undefined, code: string) {
  const text = value?.trim() ?? "";
  if (text.length < 3 || text.length > 500) {
    throw new LifecycleOperationError(code);
  }
  return text;
}

/** Applies the customer's explicit decision after a sourcing failure. */
export async function decideOrderReconfirmation(
  db: Database,
  input: {
    readonly orderId: string;
    readonly userId: string;
    readonly decision: "CONTINUE" | "CANCEL";
  },
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)))
      .for("update")
      .limit(1);
    if (!order || order.status !== "CUSTOMER_RECONFIRMATION_REQUIRED") {
      throw new LifecycleOperationError("ORDER_NOT_RECONFIRMABLE");
    }

    const unavailable = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order.id),
          eq(orderItems.procurementStatus, "UNAVAILABLE"),
        ),
      );
    if (unavailable.length === 0) {
      throw new LifecycleOperationError("UNAVAILABLE_ITEM_MISSING");
    }
    const itemIds = unavailable.map(({ id }) => id);
    const blockedTasks = await tx
      .select({ id: purchaseTasks.id, status: purchaseTasks.status })
      .from(purchaseTasks)
      .where(
        and(
          inArray(purchaseTasks.orderItemId, itemIds),
          eq(purchaseTasks.status, "BLOCKED"),
        ),
      )
      .for("update");

    const nextOrderStatus =
      input.decision === "CONTINUE" ? "PROCUREMENT_PENDING" : "REFUND_PENDING";
    orderStateMachine.assertTransition(order.status, nextOrderStatus);
    const now = new Date();

    if (input.decision === "CONTINUE") {
      orderItemProcurementStateMachine.assertTransition(
        "UNAVAILABLE",
        "PENDING",
      );
      for (const task of blockedTasks) {
        purchaseTaskStateMachine.assertTransition(task.status, "OPEN");
      }
      await tx
        .update(orderItems)
        .set({ procurementStatus: "PENDING", updatedAt: now })
        .where(inArray(orderItems.id, itemIds));
      if (blockedTasks.length > 0) {
        await tx
          .update(purchaseTasks)
          .set({
            status: "OPEN",
            assignedToUserId: null,
            blockedReason: null,
            updatedAt: now,
          })
          .where(
            inArray(
              purchaseTasks.id,
              blockedTasks.map(({ id }) => id),
            ),
          );
      }
    } else {
      orderItemProcurementStateMachine.assertTransition(
        "UNAVAILABLE",
        "CANCELLED",
      );
      for (const task of blockedTasks) {
        purchaseTaskStateMachine.assertTransition(task.status, "CANCELLED");
      }
      await tx
        .update(orderItems)
        .set({ procurementStatus: "CANCELLED", updatedAt: now })
        .where(inArray(orderItems.id, itemIds));
      if (blockedTasks.length > 0) {
        await tx
          .update(purchaseTasks)
          .set({ status: "CANCELLED", updatedAt: now })
          .where(
            inArray(
              purchaseTasks.id,
              blockedTasks.map(({ id }) => id),
            ),
          );
      }
    }

    await tx
      .update(orders)
      .set({ status: nextOrderStatus, updatedAt: now })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: nextOrderStatus,
      actorUserId: input.userId,
      note:
        input.decision === "CONTINUE"
          ? "مشتری ادامه تهیه از منبع جایگزین را تأیید کرد"
          : "مشتری لغو و بازپرداخت را درخواست کرد",
    });
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.customer_decision",
      payload: {
        orderNumber: order.orderNumber,
        decision: input.decision,
        to: nextOrderStatus,
      },
    });
    return { status: nextOrderStatus } as const;
  });
}

/** Audited, state-machine-backed operations for the final delivery/refund leg. */
export async function operateOrderLifecycle(
  db: Database,
  input: {
    readonly orderId: string;
    readonly actorUserId: string;
    readonly action:
      | "START_LOCAL_DELIVERY"
      | "DISPATCH_LOCAL"
      | "DELIVERY_FAILED"
      | "DELIVER"
      | "REQUEST_REFUND"
      | "COMPLETE_REFUND";
    readonly courier?: string;
    readonly trackingCode?: string;
    readonly reason?: string;
    readonly refundReference?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .for("update")
      .limit(1);
    if (!order) throw new LifecycleOperationError("ORDER_NOT_FOUND");

    const now = new Date();
    let toStatus: typeof order.status;
    let note: string;
    if (input.action === "START_LOCAL_DELIVERY") {
      toStatus = "LOCAL_DELIVERY_PENDING";
      note = "سفارش وارد صف ارسال داخلی شد";
      assertOrderTransition(order.status, toStatus, moneyOf(order));
      const [existing] = await tx
        .select({ id: localDeliveries.id })
        .from(localDeliveries)
        .where(eq(localDeliveries.orderId, order.id))
        .limit(1);
      if (!existing) {
        await tx.insert(localDeliveries).values({
          orderId: order.id,
          addressId: order.shippingAddressId,
          status: "PENDING",
        });
      }
    } else if (input.action === "DISPATCH_LOCAL") {
      toStatus = "OUT_FOR_DELIVERY";
      const courier = requiredText(input.courier, "COURIER_REQUIRED");
      const trackingCode = requiredText(
        input.trackingCode,
        "TRACKING_CODE_REQUIRED",
      );
      note = `تحویل به ${courier} با کد پیگیری ${trackingCode}`;
      assertOrderTransition(order.status, toStatus, moneyOf(order));
      const [delivery] = await tx
        .select({ id: localDeliveries.id })
        .from(localDeliveries)
        .where(eq(localDeliveries.orderId, order.id))
        .orderBy(localDeliveries.createdAt)
        .limit(1);
      if (!delivery) throw new LifecycleOperationError("DELIVERY_NOT_FOUND");
      await tx
        .update(localDeliveries)
        .set({
          courier,
          trackingCode,
          status: "OUT_FOR_DELIVERY",
          failureReason: null,
          updatedAt: now,
        })
        .where(eq(localDeliveries.id, delivery.id));
    } else if (input.action === "DELIVERY_FAILED") {
      toStatus = "LOCAL_DELIVERY_PENDING";
      note = requiredText(input.reason, "REASON_REQUIRED");
      assertOrderTransition(order.status, toStatus, moneyOf(order));
      await tx
        .update(localDeliveries)
        .set({ status: "FAILED", failureReason: note, updatedAt: now })
        .where(eq(localDeliveries.orderId, order.id));
    } else if (input.action === "DELIVER") {
      toStatus = "DELIVERED";
      note = "تحویل به مشتری تأیید شد";
      assertOrderTransition(order.status, toStatus, moneyOf(order));
      await tx
        .update(localDeliveries)
        .set({ status: "DELIVERED", deliveredAt: now, updatedAt: now })
        .where(eq(localDeliveries.orderId, order.id));
    } else if (input.action === "REQUEST_REFUND") {
      toStatus = "REFUND_PENDING";
      note = requiredText(input.reason, "REASON_REQUIRED");
      assertOrderTransition(order.status, toStatus, moneyOf(order));
    } else {
      toStatus = "REFUNDED";
      note = requiredText(input.refundReference, "REFUND_REFERENCE_REQUIRED");
      assertOrderTransition(order.status, toStatus, moneyOf(order));
      const amount = order.depositPaidToman + order.balancePaidToman;
      if (amount <= 0n)
        throw new LifecycleOperationError("REFUND_AMOUNT_INVALID");
      await tx
        .insert(payments)
        .values({
          orderId: order.id,
          type: "REFUND",
          method: "GATEWAY",
          provider: "manual-refund",
          amountToman: amount,
          providerReference: note,
          idempotencyKey: `refund:${order.id}`,
          status: "SUCCEEDED",
          verifiedAt: now,
        })
        .onConflictDoNothing({ target: payments.idempotencyKey });
    }

    await tx
      .update(orders)
      .set({ status: toStatus, updatedAt: now })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus,
      actorUserId: input.actorUserId,
      note,
    });
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType:
        toStatus === "REFUNDED" ? "order.refunded" : "order.status_changed",
      payload: {
        orderNumber: order.orderNumber,
        from: order.status,
        to: toStatus,
      },
    });
    await tx.insert(adminAuditLog).values({
      actorUserId: input.actorUserId,
      action: `orders.${input.action.toLowerCase()}`,
      entityType: "order",
      entityId: order.id,
      before: { status: order.status },
      after: { status: toStatus, note },
    });
    return { status: toStatus } as const;
  });
}
