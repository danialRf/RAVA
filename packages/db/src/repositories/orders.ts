import {
  assertOrderTransition,
  type OrderMoneyContext,
  type OrderStatus,
  type PaymentMethod,
  type PaymentType,
} from "@rava/domain";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  orderItems,
  orderStatusHistory,
  orders,
  outboxEvents,
  payments,
} from "../schema";
import type { Executor } from "./executor";

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Order ${id} was not found`);
    this.name = "OrderNotFoundError";
  }
}

export async function getOrderById(executor: Executor, orderId: string) {
  const [order] = await executor
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}

export async function getOrderByNumber(
  executor: Executor,
  orderNumber: string,
) {
  const [order] = await executor
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  return order ?? null;
}

export async function listOrdersForUser(
  executor: Executor,
  userId: string,
  limit = 20,
) {
  return executor
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function listOrderItems(executor: Executor, orderId: string) {
  return executor
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(desc(orderItems.createdAt));
}

function moneyContextOf(order: typeof orders.$inferSelect): OrderMoneyContext {
  return {
    totalLockedToman: order.totalLockedToman,
    depositRequiredToman: order.depositRequiredToman,
    depositPaidToman: order.depositPaidToman,
    balanceDueToman: order.balanceDueToman,
    balancePaidToman: order.balancePaidToman,
  };
}

/**
 * Moves an order to a new status.
 *
 * The pure guard in `@rava/domain` decides legality; this function only owns
 * persistence. Status row, history entry and outbox event are written in one
 * transaction so a customer notification can never describe a state that was
 * rolled back.
 */
export async function transitionOrderStatus(
  db: Database,
  input: {
    readonly orderId: string;
    readonly toStatus: OrderStatus;
    readonly actorUserId?: string | null;
    readonly note?: string;
  },
): Promise<typeof orders.$inferSelect> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      // Serialises concurrent admin actions on the same order.
      .for("update")
      .limit(1);

    if (order === undefined) throw new OrderNotFoundError(input.orderId);

    assertOrderTransition(order.status, input.toStatus, moneyContextOf(order));

    const [updated] = await tx
      .update(orders)
      .set({ status: input.toStatus, updatedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();

    if (updated === undefined) throw new OrderNotFoundError(input.orderId);

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId ?? null,
      note: input.note ?? null,
    });

    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.status_changed",
      payload: {
        orderNumber: order.orderNumber,
        from: order.status,
        to: input.toStatus,
      },
    });

    return updated;
  });
}

export interface PaymentCapture {
  readonly orderId: string;
  readonly type: PaymentType;
  readonly method: PaymentMethod;
  readonly provider: string;
  readonly amountToman: bigint;
  readonly idempotencyKey: string;
  readonly providerReference?: string | null;
}

export interface PaymentCaptureResult {
  readonly paymentId: string;
  /** False when the same idempotency key was already captured. */
  readonly applied: boolean;
}

/**
 * Records a successful payment exactly once.
 *
 * Payment callbacks are retried by gateways, so the idempotency key is the
 * authority: a repeat call returns the original payment and leaves the order
 * totals untouched. REFUND rows are stored but never increase paid totals.
 */
export async function capturePayment(
  db: Database,
  capture: PaymentCapture,
): Promise<PaymentCaptureResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.idempotencyKey, capture.idempotencyKey))
      .limit(1);

    if (existing !== undefined) {
      return { paymentId: existing.id, applied: false };
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, capture.orderId))
      .for("update")
      .limit(1);

    if (order === undefined) throw new OrderNotFoundError(capture.orderId);

    const now = new Date();
    const [payment] = await tx
      .insert(payments)
      .values({
        orderId: capture.orderId,
        type: capture.type,
        method: capture.method,
        provider: capture.provider,
        amountToman: capture.amountToman,
        providerReference: capture.providerReference ?? null,
        idempotencyKey: capture.idempotencyKey,
        status: "SUCCEEDED",
        verifiedAt: now,
      })
      .returning({ id: payments.id });

    if (payment === undefined) {
      throw new Error("Payment insert did not return a row");
    }

    if (capture.type !== "REFUND") {
      const column =
        capture.type === "DEPOSIT"
          ? orders.depositPaidToman
          : orders.balancePaidToman;
      await tx
        .update(orders)
        .set(
          capture.type === "DEPOSIT"
            ? {
                depositPaidToman: sql`${column} + ${capture.amountToman}`,
                updatedAt: now,
              }
            : {
                balancePaidToman: sql`${column} + ${capture.amountToman}`,
                updatedAt: now,
              },
        )
        .where(eq(orders.id, order.id));
    }

    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.payment_captured",
      payload: {
        orderNumber: order.orderNumber,
        paymentType: capture.type,
        amountToman: capture.amountToman.toString(),
      },
    });

    return { paymentId: payment.id, applied: true };
  });
}

/** Successful payments only, used for reconciliation views. */
export async function listSuccessfulPayments(
  executor: Executor,
  orderId: string,
) {
  return executor
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "SUCCEEDED")))
    .orderBy(desc(payments.verifiedAt));
}

export async function listOrderStatusHistory(
  executor: Executor,
  orderId: string,
) {
  return executor
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(orderStatusHistory.createdAt);
}
