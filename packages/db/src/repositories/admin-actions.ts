import {
  orderItemProcurementStateMachine,
  paymentStateMachine,
  purchaseTaskStateMachine,
} from "@rava/domain";
import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import {
  adminAuditLog,
  orderItems,
  orders,
  orderStatusHistory,
  outboxEvents,
  paymentReceipts,
  payments,
  purchaseTasks,
} from "../schema";
import { ensurePurchaseTasksForOrder } from "./procurement";

export class AdminOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AdminOperationError";
  }
}

function requiredReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new AdminOperationError("REASON_INVALID");
  }
  return reason;
}

export async function reviewCardPayment(
  db: Database,
  input: {
    readonly paymentId: string;
    readonly actorUserId: string;
    readonly decision: "APPROVE" | "REJECT";
    readonly reason: string;
  },
) {
  const reason = requiredReason(input.reason);
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .for("update")
      .limit(1);
    if (
      payment === undefined ||
      payment.method !== "CARD_TO_CARD" ||
      payment.status !== "PENDING_VERIFICATION"
    ) {
      throw new AdminOperationError("PAYMENT_NOT_REVIEWABLE");
    }

    const [receipt] = await tx
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.paymentId, payment.id))
      .orderBy(desc(paymentReceipts.createdAt))
      .limit(1);
    if (receipt === undefined) {
      throw new AdminOperationError("PAYMENT_RECEIPT_MISSING");
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .for("update")
      .limit(1);
    if (order === undefined || order.status !== "DEPOSIT_PENDING") {
      throw new AdminOperationError("ORDER_NOT_PAYABLE");
    }

    const now = new Date();
    if (input.decision === "REJECT") {
      paymentStateMachine.assertTransition(payment.status, "FAILED");
      await tx
        .update(payments)
        .set({ status: "FAILED", failureReason: reason, updatedAt: now })
        .where(eq(payments.id, payment.id));
      await tx
        .update(paymentReceipts)
        .set({ reviewedByUserId: input.actorUserId, reviewNote: reason })
        .where(eq(paymentReceipts.id, receipt.id));
      await tx.insert(adminAuditLog).values({
        actorUserId: input.actorUserId,
        action: "payment.card_receipt_rejected",
        entityType: "payment",
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: "FAILED", reason },
      });
      return { decision: input.decision, orderId: order.id } as const;
    }

    if (payment.amountToman !== order.depositRequiredToman) {
      throw new AdminOperationError("PAYMENT_AMOUNT_MISMATCH");
    }
    paymentStateMachine.assertTransition(payment.status, "SUCCEEDED");
    await ensurePurchaseTasksForOrder(tx, order.id);
    await tx
      .update(payments)
      .set({
        status: "SUCCEEDED",
        verifiedAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));
    await tx
      .update(paymentReceipts)
      .set({ reviewedByUserId: input.actorUserId, reviewNote: reason })
      .where(eq(paymentReceipts.id, receipt.id));
    await tx
      .update(orders)
      .set({
        depositPaidToman: payment.amountToman,
        status: "PROCUREMENT_PENDING",
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values([
      {
        orderId: order.id,
        fromStatus: "DEPOSIT_PENDING",
        toStatus: "DEPOSIT_PAID",
        actorUserId: input.actorUserId,
        note: "پیش‌پرداخت کارت‌به‌کارت تأیید شد",
      },
      {
        orderId: order.id,
        fromStatus: "DEPOSIT_PAID",
        toStatus: "PROCUREMENT_PENDING",
        actorUserId: input.actorUserId,
      },
    ]);
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.deposit_paid",
      payload: {
        orderNumber: order.orderNumber,
        amountToman: payment.amountToman.toString(),
        method: "CARD_TO_CARD",
      },
    });
    await tx.insert(adminAuditLog).values({
      actorUserId: input.actorUserId,
      action: "payment.card_receipt_approved",
      entityType: "payment",
      entityId: payment.id,
      before: { status: payment.status, orderStatus: order.status },
      after: {
        status: "SUCCEEDED",
        orderStatus: "PROCUREMENT_PENDING",
        amountToman: payment.amountToman.toString(),
        reason,
      },
    });
    return { decision: input.decision, orderId: order.id } as const;
  });
}

export async function updateProcurementItem(
  db: Database,
  input: {
    readonly orderItemId: string;
    readonly actorUserId: string;
    readonly action: "ASSIGN_TO_SELF" | "START" | "MARK_UNAVAILABLE";
    readonly reason?: string;
  },
) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, input.orderItemId))
      .for("update")
      .limit(1);
    if (item === undefined) throw new AdminOperationError("ITEM_NOT_FOUND");
    const [task] = await tx
      .select()
      .from(purchaseTasks)
      .where(
        and(
          eq(purchaseTasks.orderItemId, item.id),
          inArray(purchaseTasks.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"]),
        ),
      )
      .for("update")
      .limit(1);
    if (task === undefined) throw new AdminOperationError("TASK_NOT_FOUND");

    let nextItemStatus: "ASSIGNED" | "UNAVAILABLE" = "ASSIGNED";
    let nextTaskStatus: "ASSIGNED" | "IN_PROGRESS" | "BLOCKED" = "ASSIGNED";
    let reason: string | null = null;
    if (input.action === "ASSIGN_TO_SELF") {
      orderItemProcurementStateMachine.assertTransition(
        item.procurementStatus,
        "ASSIGNED",
      );
      if (task.status !== "OPEN") {
        throw new AdminOperationError("TASK_NOT_ASSIGNABLE");
      }
      purchaseTaskStateMachine.assertTransition(task.status, "ASSIGNED");
    } else if (input.action === "START") {
      if (
        item.procurementStatus !== "ASSIGNED" ||
        task.status !== "ASSIGNED" ||
        task.assignedToUserId !== input.actorUserId
      ) {
        throw new AdminOperationError("TASK_NOT_STARTABLE");
      }
      purchaseTaskStateMachine.assertTransition(task.status, "IN_PROGRESS");
      nextTaskStatus = "IN_PROGRESS";
    } else {
      reason = requiredReason(input.reason ?? "");
      if (
        item.procurementStatus !== "ASSIGNED" ||
        task.assignedToUserId !== input.actorUserId ||
        !["ASSIGNED", "IN_PROGRESS"].includes(task.status)
      ) {
        throw new AdminOperationError("TASK_NOT_BLOCKABLE");
      }
      orderItemProcurementStateMachine.assertTransition(
        item.procurementStatus,
        "UNAVAILABLE",
      );
      purchaseTaskStateMachine.assertTransition(task.status, "BLOCKED");
      nextItemStatus = "UNAVAILABLE";
      nextTaskStatus = "BLOCKED";
    }

    const now = new Date();
    await tx
      .update(orderItems)
      .set({ procurementStatus: nextItemStatus, updatedAt: now })
      .where(eq(orderItems.id, item.id));
    await tx
      .update(purchaseTasks)
      .set({
        assignedToUserId:
          input.action === "ASSIGN_TO_SELF"
            ? input.actorUserId
            : task.assignedToUserId,
        status: nextTaskStatus,
        blockedReason: reason,
        updatedAt: now,
      })
      .where(eq(purchaseTasks.id, task.id));
    await tx.insert(adminAuditLog).values({
      actorUserId: input.actorUserId,
      action: `procurement.${input.action.toLowerCase()}`,
      entityType: "order_item",
      entityId: item.id,
      before: {
        procurementStatus: item.procurementStatus,
        taskStatus: task.status,
        assignedToUserId: task.assignedToUserId,
      },
      after: {
        procurementStatus: nextItemStatus,
        taskStatus: nextTaskStatus,
        assignedToUserId:
          input.action === "ASSIGN_TO_SELF"
            ? input.actorUserId
            : task.assignedToUserId,
        reason,
      },
    });
    return { itemStatus: nextItemStatus, taskStatus: nextTaskStatus };
  });
}
