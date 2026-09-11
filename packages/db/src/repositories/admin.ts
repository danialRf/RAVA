import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  adminAuditLog,
  brands,
  categories,
  contentEntries,
  fxRates,
  jobsAudit,
  orderItems,
  orders,
  outboxEvents,
  paymentReceipts,
  payments,
  productRequests,
  products,
  productMedia,
  productVariants,
  purchaseDocuments,
  purchases,
  purchaseTasks,
  pricingRules,
  retailers,
  scraperRuns,
  sourceOffers,
  tripItems,
  trips,
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

export async function listAdminCatalog(executor: Executor, limit = 100) {
  return executor
    .select({
      id: products.id,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      descriptionFa: products.descriptionFa,
      slug: products.slug,
      status: products.status,
      weightGrams: products.weightGrams,
      transportClass: products.transportClass,
      brandName: brands.name,
      categoryName: categories.nameFa,
      brandId: products.brandId,
      categoryId: products.categoryId,
      imageUrl: sql<
        string | null
      >`(select coalesce(${productMedia.sourceUrl}, ${productMedia.storageKey}) from ${productMedia} where ${productMedia.productId} = ${products.id} order by case when ${productMedia.kind} = 'PRIMARY' then 0 else 1 end, ${productMedia.sortOrder} limit 1)`,
      variantCount: sql<number>`(select count(*)::int from ${productVariants} where ${productVariants.productId} = ${products.id})`,
      offerCount: sql<number>`(select count(*)::int from ${sourceOffers} inner join ${productVariants} on ${sourceOffers.productVariantId} = ${productVariants.id} where ${productVariants.productId} = ${products.id})`,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(desc(products.updatedAt))
    .limit(limit);
}

export async function getAdminProductFormOptions(executor: Executor) {
  const [brandRows, categoryRows] = await Promise.all([
    executor
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(eq(brands.isActive, true))
      .orderBy(brands.name),
    executor
      .select({ id: categories.id, name: categories.nameFa })
      .from(categories)
      .where(eq(categories.isEnabled, true))
      .orderBy(categories.sortOrder, categories.nameFa),
  ]);
  return { brands: brandRows, categories: categoryRows };
}

export async function listAdminOffers(executor: Executor, limit = 100) {
  return executor
    .select({
      id: sourceOffers.id,
      rawTitle: sourceOffers.rawTitle,
      sourceUrl: sourceOffers.sourceUrl,
      sourcePriceEurCents: sourceOffers.sourcePriceEurCents,
      stockStatus: sourceOffers.stockStatus,
      sourceVerified: sourceOffers.sourceVerified,
      retailerId: sourceOffers.retailerId,
      productVariantId: sourceOffers.productVariantId,
      shippingEurCents: sourceOffers.shippingEurCents,
      expiresAt: sourceOffers.expiresAt,
      retailerName: retailers.name,
      productTitle: products.titleFa,
      lastSeenAt: sourceOffers.lastSeenAt,
    })
    .from(sourceOffers)
    .innerJoin(retailers, eq(retailers.id, sourceOffers.retailerId))
    .leftJoin(
      productVariants,
      eq(productVariants.id, sourceOffers.productVariantId),
    )
    .leftJoin(products, eq(products.id, productVariants.productId))
    .orderBy(desc(sourceOffers.lastSeenAt))
    .limit(limit);
}

export async function getAdminOfferFormOptions(executor: Executor) {
  const [sourceRows, variantRows] = await Promise.all([
    executor
      .select({
        id: retailers.id,
        name: retailers.name,
        isEnabled: retailers.isEnabled,
      })
      .from(retailers)
      .orderBy(retailers.name),
    executor
      .select({
        id: productVariants.id,
        sku: productVariants.skuInternal,
        title: products.titleFa,
        size: productVariants.size,
        color: productVariants.color,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .orderBy(products.titleFa, productVariants.skuInternal),
  ]);
  return { retailers: sourceRows, variants: variantRows };
}

export async function listAdminPricingRules(executor: Executor) {
  return executor
    .select({
      id: pricingRules.id,
      scope: pricingRules.scope,
      priority: pricingRules.priority,
      targetMarginBps: pricingRules.targetMarginBps,
      minProfitToman: pricingRules.minProfitToman,
      transportClass: pricingRules.transportClass,
      customsRiskBps: pricingRules.customsRiskBps,
      fxBufferBps: pricingRules.fxBufferBps,
      paymentFeeBps: pricingRules.paymentFeeBps,
      depositBps: pricingRules.depositBps,
      minDepositToman: pricingRules.minDepositToman,
      roundingUnitToman: pricingRules.roundingUnitToman,
      activeFrom: pricingRules.activeFrom,
      activeTo: pricingRules.activeTo,
      notes: pricingRules.notes,
    })
    .from(pricingRules)
    .orderBy(desc(pricingRules.priority), desc(pricingRules.activeFrom));
}

export async function listAdminTrips(executor: Executor) {
  return executor
    .select({
      id: trips.id,
      code: trips.code,
      title: trips.title,
      status: trips.status,
      departureWindowStart: trips.departureWindowStart,
      arrivalWindowEnd: trips.arrivalWindowEnd,
      capacityWeightGrams: trips.capacityWeightGrams,
      itemCount: sql<number>`(select count(*)::int from ${tripItems} where ${tripItems.tripId} = ${trips.id})`,
      assignedWeightGrams: sql<number>`coalesce((select sum(${tripItems.packedWeightGrams})::int from ${tripItems} where ${tripItems.tripId} = ${trips.id}), 0)`,
    })
    .from(trips)
    .orderBy(desc(trips.departureWindowStart), desc(trips.createdAt));
}

export async function listOrdersAwaitingTrip(executor: Executor) {
  return executor
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: users.displayName,
      itemCount: sql<number>`(select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.status, "TRIP_PENDING"))
    .orderBy(orders.createdAt);
}

export async function listAdminCustomers(executor: Executor, limit = 100) {
  return executor
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      phoneE164: users.phoneE164,
      status: users.status,
      createdAt: users.createdAt,
      orderCount: sql<number>`count(${orders.id})::int`,
      totalPaidToman: sql<bigint>`coalesce(sum(${orders.depositPaidToman} + ${orders.balancePaidToman}), 0)`,
    })
    .from(users)
    .leftJoin(orders, eq(orders.userId, users.id))
    .where(eq(users.role, "CUSTOMER"))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function listAdminRetailers(executor: Executor) {
  return executor
    .select({
      id: retailers.id,
      name: retailers.name,
      domain: retailers.domain,
      trustTier: retailers.trustTier,
      isEnabled: retailers.isEnabled,
      defaultIntervalMinutes: retailers.defaultIntervalMinutes,
      termsNotes: retailers.termsNotes,
      lastHealthStatus: retailers.lastHealthStatus,
      lastHealthAt: retailers.lastHealthAt,
      offerCount: sql<number>`(select count(*)::int from ${sourceOffers} where ${sourceOffers.retailerId} = ${retailers.id})`,
    })
    .from(retailers)
    .orderBy(retailers.name);
}

export async function listAdminContent(executor: Executor) {
  return executor
    .select()
    .from(contentEntries)
    .orderBy(desc(contentEntries.updatedAt));
}

export async function listAdminProductRequests(executor: Executor) {
  return executor
    .select({
      id: productRequests.id,
      descriptionFa: productRequests.descriptionFa,
      referenceUrl: productRequests.referenceUrl,
      budgetToman: productRequests.budgetToman,
      status: productRequests.status,
      customerName: users.displayName,
      customerEmail: users.email,
      createdAt: productRequests.createdAt,
    })
    .from(productRequests)
    .leftJoin(users, eq(users.id, productRequests.userId))
    .orderBy(desc(productRequests.createdAt));
}

export async function getAdminHealth(executor: Executor) {
  const [fx] = await executor
    .select()
    .from(fxRates)
    .orderBy(desc(fxRates.fetchedAt))
    .limit(1);
  const [failedJobs] = await executor
    .select({ value: count() })
    .from(jobsAudit)
    .where(eq(jobsAudit.status, "FAILED"));
  const [pendingOutbox] = await executor
    .select({ value: count() })
    .from(outboxEvents)
    .where(inArray(outboxEvents.status, ["PENDING", "FAILED"]));
  const [failedScrapers] = await executor
    .select({ value: count() })
    .from(scraperRuns)
    .where(inArray(scraperRuns.status, ["FAILED", "PARTIAL"]));
  return {
    latestFx: fx ?? null,
    failedJobs: failedJobs?.value ?? 0,
    pendingOutbox: pendingOutbox?.value ?? 0,
    failedScrapers: failedScrapers?.value ?? 0,
    retailers: await listAdminRetailers(executor),
  };
}

export async function listAdminOrders(
  executor: Executor,
  limit = 50,
  customerId?: string,
) {
  const query = executor
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
    .$dynamic();
  return (customerId ? query.where(eq(orders.userId, customerId)) : query)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getAdminOrderDetails(
  executor: Executor,
  orderId: string,
) {
  const [order] = await executor
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalLockedToman: orders.totalLockedToman,
      depositPaidToman: orders.depositPaidToman,
      balanceDueToman: orders.balanceDueToman,
      balancePaidToman: orders.balancePaidToman,
      customerName: users.displayName,
      customerEmail: users.email,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (order === undefined) return null;
  const items = await executor
    .select({
      id: orderItems.id,
      productSnapshot: orderItems.productSnapshot,
      offerSnapshot: orderItems.offerSnapshot,
      quantity: orderItems.quantity,
      lineTotalToman: orderItems.lineTotalToman,
      procurementStatus: orderItems.procurementStatus,
      purchaseEurCents: purchases.purchaseEurCents,
      shippingEurCents: purchases.shippingEurCents,
      retailerOrderRefMasked: purchases.retailerOrderRefMasked,
      purchasedAt: purchases.purchasedAt,
      receiptDocumentId: sql<
        string | null
      >`(select ${purchaseDocuments.id} from ${purchaseDocuments} where ${purchaseDocuments.purchaseId} = ${purchases.id} order by ${purchaseDocuments.createdAt} desc limit 1)`.as(
        "receipt_document_id",
      ),
    })
    .from(orderItems)
    .leftJoin(purchases, eq(purchases.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.createdAt);
  return { order, items };
}

export async function getPurchaseDocumentForAdmin(
  executor: Executor,
  documentId: string,
) {
  const [document] = await executor
    .select({
      id: purchaseDocuments.id,
      storageKey: purchaseDocuments.storageKey,
      contentType: purchaseDocuments.contentType,
    })
    .from(purchaseDocuments)
    .where(eq(purchaseDocuments.id, documentId))
    .limit(1);
  return document ?? null;
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
      type: payments.type,
      method: payments.method,
      status: payments.status,
      customerName: users.displayName,
      customerEmail: users.email,
      receiptId: sql<
        string | null
      >`(select ${paymentReceipts.id} from ${paymentReceipts} where ${paymentReceipts.paymentId} = ${payments.id} order by ${paymentReceipts.createdAt} desc limit 1)`.as(
        "receipt_id",
      ),
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(payments.status, "PENDING_VERIFICATION"))
    .orderBy(payments.createdAt)
    .limit(limit);
}

export async function getPaymentReceiptForAdmin(
  executor: Executor,
  receiptId: string,
) {
  const [receipt] = await executor
    .select({
      id: paymentReceipts.id,
      storageKey: paymentReceipts.storageKey,
      contentType: paymentReceipts.contentType,
    })
    .from(paymentReceipts)
    .where(eq(paymentReceipts.id, receiptId))
    .limit(1);
  return receipt ?? null;
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
      taskStatus: purchaseTasks.status,
      assignedToUserId: purchaseTasks.assignedToUserId,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(
      purchaseTasks,
      and(
        eq(purchaseTasks.orderItemId, orderItems.id),
        inArray(purchaseTasks.status, ["OPEN", "ASSIGNED", "IN_PROGRESS"]),
      ),
    )
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
