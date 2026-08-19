import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  adminAuditLog,
  orderItems,
  orders,
  paymentReceipts,
  payments,
  productRequests,
  purchaseTasks,
  users,
} from "../schema";
import type { Executor } from "./executor";

const PROCUREMENT_ORDER_STATUSES = [
  "PROCUREMENT_PENDING",
  "PROCUREMENT_IN_PROGRESS",
] as const;

/** Operational totals only; no inferred conversion or vanity metrics. */
export async function getAdminOverview(executor: Executor) {
  const [
    ordersAwaitingProcurement,
    paymentsNeedingReview,
    openRequests,
    openTasks,
  ] = await Promise.all([
    executor
      .select({ value: count() })
      .from(orders)
      .where(inArray(orders.status, [...PROCUREMENT_ORDER_STATUSES])),
    executor
      .select({ value: count() })
      .from(payments)
      .where(eq(payments.status, "PENDING_VERIFICATION")),
    executor
      .select({ value: count() })
      .from(productRequests)
      .where(inArray(productRequests.status, ["SUBMITTED", "IN_RESEARCH"])),
    executor
      .select({ value: count() })
      .from(purchaseTasks)
      .where(
        inArray(purchaseTasks.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"]),
      ),
  ]);

  const [money] = await executor
    .select({
      depositsReceived: sql<bigint>`coalesce(sum(${orders.depositPaidToman}), 0)`,
      outstandingBalances: sql<bigint>`coalesce(sum(${orders.balanceDueToman} - ${orders.balancePaidToman}), 0)`,
    })
    .from(orders)
    .where(sql`${orders.status} not in ('CANCELLED', 'REFUNDED')`);

  return {
    ordersAwaitingProcurement: ordersAwaitingProcurement[0]?.value ?? 0,
    paymentsNeedingReview: paymentsNeedingReview[0]?.value ?? 0,
    openProductRequests: openRequests[0]?.value ?? 0,
    openPurchaseTasks: openTasks[0]?.value ?? 0,
    depositsReceived: BigInt(money?.depositsReceived ?? 0),
    outstandingBalances: BigInt(money?.outstandingBalances ?? 0),
  };
}

export async function listAdminOrders(executor: Executor, limit = 50) {
  return executor
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalLockedToman: orders.totalLockedToman,
      depositPaidToman: orders.depositPaidToman,
      customerName: users.displayName,
      customerEmail: users.email,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function listPaymentsNeedingReview(
  executor: Executor,
  limit = 50,
) {
  return executor
    .select({
      id: payments.id,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      amountToman: payments.amountToman,
      method: payments.method,
      status: payments.status,
      customerName: users.displayName,
      customerEmail: users.email,
      receiptId: paymentReceipts.id,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, orders.userId))
    .leftJoin(paymentReceipts, eq(paymentReceipts.paymentId, payments.id))
    .where(eq(payments.status, "PENDING_VERIFICATION"))
    .orderBy(payments.createdAt)
    .limit(limit);
}

export async function listProcurementQueue(executor: Executor, limit = 50) {
  return executor
    .select({
      id: orderItems.id,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      productSnapshot: orderItems.productSnapshot,
      offerSnapshot: orderItems.offerSnapshot,
      quantity: orderItems.quantity,
      maxSourcePriceEurCents: orderItems.maxSourcePriceEurCents,
      procurementStatus: orderItems.procurementStatus,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        inArray(orders.status, [...PROCUREMENT_ORDER_STATUSES]),
        inArray(orderItems.procurementStatus, ["PENDING", "ASSIGNED"]),
      ),
    )
    .orderBy(orderItems.createdAt)
    .limit(limit);
}

export async function listAdminAuditLog(executor: Executor, limit = 100) {
  return executor
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entityType: adminAuditLog.entityType,
      entityId: adminAuditLog.entityId,
      actorName: users.displayName,
      actorEmail: users.email,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
