import {
  assertOrderTransition,
  orderStateMachine,
  tripStateMachine,
  type StockStatus,
} from "@rava/domain";
import { asc, eq, inArray } from "drizzle-orm";

import type { Database } from "../client";
import {
  adminAuditLog,
  brands,
  categories,
  contentEntries,
  orderItems,
  orders,
  orderStatusHistory,
  offerPriceHistory,
  outboxEvents,
  pricingRules,
  productRequests,
  products,
  productMedia,
  productVariants,
  retailers,
  sourceOffers,
  trips,
  tripItems,
} from "../schema";
import { AdminOperationError } from "./admin-actions";

function auditJson(value: Record<string, unknown> | null) {
  if (value === null) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as Record<string, unknown>;
}

async function audit(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  await tx.insert(adminAuditLog).values({
    actorUserId,
    action,
    entityType,
    entityId,
    before: auditJson(before),
    after: auditJson(after)!,
  });
}

export async function updateAdminProduct(
  db: Database,
  input: {
    id: string;
    actorUserId: string;
    titleFa: string;
    titleOriginal?: string;
    brandId?: string;
    categoryId?: string;
    descriptionFa: string | null;
    status: "DRAFT" | "NEEDS_REVIEW" | "PUBLISHED" | "ARCHIVED";
    weightGrams: number | null;
    transportClass: "XS" | "S" | "M" | "L" | "BLOCKED" | null;
    /**
     * Sell price for the product's default variant, in integer Toman.
     * `undefined` leaves the current price untouched; `null` clears it and
     * returns the product to source-offer pricing.
     */
    manualPriceToman?: bigint | null;
    manualStockStatus?: StockStatus | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
  },
) {
  const title = input.titleFa.trim();
  if (
    title.length < 2 ||
    title.length > 200 ||
    (input.weightGrams ?? 1) <= 0 ||
    (input.manualPriceToman != null && input.manualPriceToman <= 0n)
  ) {
    throw new AdminOperationError("PRODUCT_INPUT_INVALID");
  }
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("PRODUCT_NOT_FOUND");
    const after = {
      titleFa: title,
      titleOriginal: input.titleOriginal?.trim() || before.titleOriginal,
      brandId: input.brandId ?? before.brandId,
      categoryId: input.categoryId ?? before.categoryId,
      descriptionFa: input.descriptionFa?.trim() || null,
      status: input.status,
      weightGrams: input.weightGrams,
      transportClass: input.transportClass,
      publishedAt:
        input.status === "PUBLISHED"
          ? (before.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    };
    await tx.update(products).set(after).where(eq(products.id, input.id));

    // The price lives on the default (oldest) variant, which is the one the
    // simplified product form creates and edits.
    if (input.manualPriceToman !== undefined) {
      const [defaultVariant] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, input.id))
        .orderBy(asc(productVariants.createdAt))
        .limit(1);
      if (defaultVariant) {
        await tx
          .update(productVariants)
          .set({
            manualPriceToman: input.manualPriceToman,
            manualStockStatus:
              input.manualPriceToman === null
                ? null
                : (input.manualStockStatus ?? "IN_STOCK"),
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, defaultVariant.id));
      }
    }

    if (input.imageUrl) {
      await tx
        .update(productMedia)
        .set({ kind: "GALLERY" })
        .where(eq(productMedia.productId, input.id));
      await tx.insert(productMedia).values({
        productId: input.id,
        kind: "PRIMARY",
        sourceUrl: input.imageUrl,
        altTextFa: input.imageAlt?.trim() || title,
        sourceAttribution: "بارگذاری مستقیم مدیر فروشگاه",
        rightsNotes: "مسئولیت حق استفاده از تصویر با مدیر بارگذار است.",
      });
    }
    await audit(
      tx,
      input.actorUserId,
      "catalog.product_updated",
      "product",
      input.id,
      before,
      after,
    );
  });
}

function productSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return normalized || `product-${Date.now()}`;
}

export async function createAdminProduct(
  db: Database,
  input: {
    actorUserId: string;
    brandId: string;
    categoryId: string;
    titleFa: string;
    titleOriginal: string;
    descriptionFa: string | null;
    weightGrams: number | null;
    transportClass: "XS" | "S" | "M" | "L" | "BLOCKED" | null;
    skuInternal: string;
    size: string | null;
    color: string | null;
    /** Operator-set sell price in integer Toman. Null keeps the product unpriced. */
    manualPriceToman: bigint | null;
    manualStockStatus: StockStatus | null;
    imageUrl: string | null;
    imageAlt: string | null;
  },
) {
  const titleFa = input.titleFa.trim();
  const titleOriginal = input.titleOriginal.trim();
  const sku = input.skuInternal.trim().toUpperCase();
  if (
    titleFa.length < 2 ||
    titleOriginal.length < 2 ||
    sku.length < 2 ||
    (input.weightGrams ?? 1) <= 0 ||
    (input.manualPriceToman !== null && input.manualPriceToman <= 0n)
  )
    throw new AdminOperationError("PRODUCT_INPUT_INVALID");

  return db.transaction(async (tx) => {
    const [brand, category] = await Promise.all([
      tx
        .select({ id: brands.id })
        .from(brands)
        .where(eq(brands.id, input.brandId))
        .limit(1),
      tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, input.categoryId))
        .limit(1),
    ]);
    if (!brand[0] || !category[0])
      throw new AdminOperationError("PRODUCT_INPUT_INVALID");
    const [created] = await tx
      .insert(products)
      .values({
        brandId: input.brandId,
        categoryId: input.categoryId,
        titleFa,
        titleOriginal,
        slug: `${productSlug(titleOriginal)}-${Date.now().toString(36)}`,
        descriptionFa: input.descriptionFa?.trim() || null,
        weightGrams: input.weightGrams,
        transportClass: input.transportClass,
        status: "DRAFT",
      })
      .returning();
    if (!created) throw new AdminOperationError("PRODUCT_NOT_CREATED");
    await tx.insert(productVariants).values({
      productId: created.id,
      skuInternal: sku,
      size: input.size?.trim() || null,
      color: input.color?.trim() || null,
      manualPriceToman: input.manualPriceToman,
      manualStockStatus:
        input.manualPriceToman === null
          ? null
          : (input.manualStockStatus ?? "IN_STOCK"),
    });
    if (input.imageUrl)
      await tx.insert(productMedia).values({
        productId: created.id,
        kind: "PRIMARY",
        sourceUrl: input.imageUrl,
        altTextFa: input.imageAlt?.trim() || titleFa,
        sourceAttribution: "بارگذاری مستقیم مدیر فروشگاه",
        rightsNotes: "مسئولیت حق استفاده از تصویر با مدیر بارگذار است.",
      });
    await audit(
      tx,
      input.actorUserId,
      "catalog.product_created",
      "product",
      created.id,
      null,
      created,
    );
    return created;
  });
}

export async function archiveAdminProduct(
  db: Database,
  input: { id: string; actorUserId: string },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(products)
      .where(eq(products.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("PRODUCT_NOT_FOUND");
    const after = {
      status: "ARCHIVED" as const,
      publishedAt: null,
      updatedAt: new Date(),
    };
    await tx.update(products).set(after).where(eq(products.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "catalog.product_archived",
      "product",
      input.id,
      before,
      after,
    );
  });
}

export async function reviewAdminOffer(
  db: Database,
  input: { id: string; actorUserId: string; sourceVerified: boolean },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(sourceOffers)
      .where(eq(sourceOffers.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("OFFER_NOT_FOUND");
    if (input.sourceVerified && before.productVariantId === null) {
      throw new AdminOperationError("UNMATCHED_OFFER_CANNOT_BE_VERIFIED");
    }
    if (input.sourceVerified) {
      const [retailer] = await tx
        .select()
        .from(retailers)
        .where(eq(retailers.id, before.retailerId))
        .limit(1);
      if (
        !retailer?.isEnabled ||
        retailer.trustTier === "UNVERIFIED" ||
        (retailer.trustTier === "TRUSTED_MARKETPLACE" &&
          before.sellerId === null)
      ) {
        throw new AdminOperationError("OFFER_SOURCE_POLICY_NOT_SATISFIED");
      }
    }
    const after = {
      sourceVerified: input.sourceVerified,
      updatedAt: new Date(),
    };
    await tx
      .update(sourceOffers)
      .set(after)
      .where(eq(sourceOffers.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "catalog.offer_reviewed",
      "source_offer",
      input.id,
      { sourceVerified: before.sourceVerified },
      after,
    );
  });
}

type AdminOfferInput = {
  actorUserId: string;
  retailerId: string;
  productVariantId: string;
  sourceUrl: string;
  rawTitle: string;
  sourcePriceEurCents: bigint;
  shippingEurCents: bigint | null;
  stockStatus:
    "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN";
};

function validateAdminOffer(input: AdminOfferInput) {
  const title = input.rawTitle.trim();
  let url: URL;
  try {
    url = new URL(input.sourceUrl);
  } catch {
    throw new AdminOperationError("OFFER_URL_INVALID");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    title.length < 2 ||
    title.length > 300 ||
    input.sourcePriceEurCents <= 0n ||
    (input.shippingEurCents !== null && input.shippingEurCents < 0n)
  )
    throw new AdminOperationError("OFFER_INPUT_INVALID");
  return { title, url: url.toString(), hostname: url.hostname.toLowerCase() };
}

async function assertOfferSourceDomain(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  retailerId: string,
  hostname: string,
) {
  const [retailer] = await tx
    .select({ domain: retailers.domain })
    .from(retailers)
    .where(eq(retailers.id, retailerId))
    .limit(1);
  if (!retailer) throw new AdminOperationError("RETAILER_NOT_FOUND");
  const domain = retailer.domain.toLowerCase();
  if (hostname !== domain && !hostname.endsWith(`.${domain}`))
    throw new AdminOperationError("OFFER_RETAILER_DOMAIN_MISMATCH");
}

export async function createAdminOffer(db: Database, input: AdminOfferInput) {
  const normalized = validateAdminOffer(input);
  return db.transaction(async (tx) => {
    await assertOfferSourceDomain(tx, input.retailerId, normalized.hostname);
    const [created] = await tx
      .insert(sourceOffers)
      .values({
        retailerId: input.retailerId,
        productVariantId: input.productVariantId,
        sourceUrl: normalized.url,
        rawTitle: normalized.title,
        sourcePriceEurCents: input.sourcePriceEurCents,
        shippingEurCents: input.shippingEurCents,
        stockStatus: input.stockStatus,
        sourceVerified: false,
      })
      .returning();
    if (!created) throw new AdminOperationError("OFFER_NOT_CREATED");
    await tx.insert(offerPriceHistory).values({
      offerId: created.id,
      priceEurCents: created.sourcePriceEurCents,
      shippingEurCents: created.shippingEurCents,
      stockStatus: created.stockStatus,
    });
    await audit(
      tx,
      input.actorUserId,
      "catalog.offer_created",
      "source_offer",
      created.id,
      null,
      created,
    );
    return created;
  });
}

export async function updateAdminOffer(
  db: Database,
  input: AdminOfferInput & { id: string },
) {
  const normalized = validateAdminOffer(input);
  return db.transaction(async (tx) => {
    await assertOfferSourceDomain(tx, input.retailerId, normalized.hostname);
    const [before] = await tx
      .select()
      .from(sourceOffers)
      .where(eq(sourceOffers.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("OFFER_NOT_FOUND");
    const after = {
      retailerId: input.retailerId,
      productVariantId: input.productVariantId,
      sourceUrl: normalized.url,
      rawTitle: normalized.title,
      previousPriceEurCents:
        before.sourcePriceEurCents === input.sourcePriceEurCents
          ? before.previousPriceEurCents
          : before.sourcePriceEurCents,
      sourcePriceEurCents: input.sourcePriceEurCents,
      shippingEurCents: input.shippingEurCents,
      stockStatus: input.stockStatus,
      sourceVerified: false,
      expiresAt: null,
      // A manual edit is not a new retailer observation. Automated ingestion
      // remains the sole owner of the source freshness timestamp.
      updatedAt: new Date(),
    };
    await tx
      .update(sourceOffers)
      .set(after)
      .where(eq(sourceOffers.id, input.id));
    const observationChanged =
      before.sourcePriceEurCents !== after.sourcePriceEurCents ||
      before.shippingEurCents !== after.shippingEurCents ||
      before.stockStatus !== after.stockStatus;
    if (observationChanged)
      await tx.insert(offerPriceHistory).values({
        offerId: input.id,
        priceEurCents: after.sourcePriceEurCents,
        shippingEurCents: after.shippingEurCents,
        stockStatus: after.stockStatus,
      });
    await audit(
      tx,
      input.actorUserId,
      "catalog.offer_updated",
      "source_offer",
      input.id,
      before,
      after,
    );
  });
}

export async function archiveAdminOffer(
  db: Database,
  input: { id: string; actorUserId: string },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(sourceOffers)
      .where(eq(sourceOffers.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("OFFER_NOT_FOUND");
    const after = {
      sourceVerified: false,
      stockStatus: "OUT_OF_STOCK" as const,
      expiresAt: new Date(),
      updatedAt: new Date(),
    };
    await tx
      .update(sourceOffers)
      .set(after)
      .where(eq(sourceOffers.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "catalog.offer_archived",
      "source_offer",
      input.id,
      before,
      after,
    );
  });
}

export async function createAdminPricingRule(
  db: Database,
  input: {
    actorUserId: string;
    priority: number;
    targetMarginBps: number;
    minProfitToman: bigint;
    transportClass: "XS" | "S" | "M" | "L" | "BLOCKED";
    customsRiskBps: number;
    fxBufferBps: number;
    paymentFeeBps: number;
    depositBps: number;
    minDepositToman: bigint;
    roundingUnitToman: bigint;
    notes: string | null;
  },
) {
  if (
    input.targetMarginBps < 0 ||
    input.targetMarginBps >= 10_000 ||
    input.paymentFeeBps < 0 ||
    input.targetMarginBps + input.paymentFeeBps >= 10_000 ||
    input.depositBps <= 0 ||
    input.depositBps > 10_000 ||
    input.customsRiskBps < 0 ||
    input.fxBufferBps < 0 ||
    input.minProfitToman < 0n ||
    input.minDepositToman < 0n ||
    input.roundingUnitToman <= 0n
  )
    throw new AdminOperationError("PRICING_RULE_INVALID");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pricingRules)
      .values({
        scope: "GLOBAL",
        priority: input.priority,
        targetMarginBps: input.targetMarginBps,
        minProfitToman: input.minProfitToman,
        transportClass: input.transportClass,
        customsRiskBps: input.customsRiskBps,
        fxBufferBps: input.fxBufferBps,
        paymentFeeBps: input.paymentFeeBps,
        depositBps: input.depositBps,
        minDepositToman: input.minDepositToman,
        roundingUnitToman: input.roundingUnitToman,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!created) throw new AdminOperationError("PRICING_RULE_NOT_CREATED");
    await audit(
      tx,
      input.actorUserId,
      "pricing.rule_created",
      "pricing_rule",
      created.id,
      null,
      created,
    );
    return created;
  });
}

export async function createAdminTrip(
  db: Database,
  input: {
    actorUserId: string;
    code: string;
    title: string;
    capacityWeightGrams: number | null;
    departureWindowStart: Date | null;
    departureWindowEnd: Date | null;
    arrivalWindowStart: Date | null;
    arrivalWindowEnd: Date | null;
    notes: string | null;
  },
) {
  const code = input.code.trim().toUpperCase();
  const title = input.title.trim();
  if (
    !/^[A-Z0-9_-]{3,30}$/.test(code) ||
    title.length < 3 ||
    (input.capacityWeightGrams ?? 1) <= 0
  )
    throw new AdminOperationError("TRIP_INPUT_INVALID");
  if (
    input.departureWindowStart &&
    input.departureWindowEnd &&
    input.departureWindowEnd < input.departureWindowStart
  )
    throw new AdminOperationError("TRIP_WINDOW_INVALID");
  if (
    input.arrivalWindowStart &&
    input.arrivalWindowEnd &&
    input.arrivalWindowEnd < input.arrivalWindowStart
  )
    throw new AdminOperationError("TRIP_WINDOW_INVALID");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(trips)
      .values({
        code,
        title,
        capacityWeightGrams: input.capacityWeightGrams,
        departureWindowStart: input.departureWindowStart,
        departureWindowEnd: input.departureWindowEnd,
        arrivalWindowStart: input.arrivalWindowStart,
        arrivalWindowEnd: input.arrivalWindowEnd,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!created) throw new AdminOperationError("TRIP_NOT_CREATED");
    await audit(
      tx,
      input.actorUserId,
      "trips.created",
      "trip",
      created.id,
      null,
      created,
    );
    return created;
  });
}

export async function updateAdminTripStatus(
  db: Database,
  input: {
    id: string;
    actorUserId: string;
    status:
      | "PLANNED"
      | "COLLECTING"
      | "PACKED"
      | "DEPARTED"
      | "ARRIVED"
      | "DISTRIBUTED"
      | "CANCELLED";
  },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(trips)
      .where(eq(trips.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("TRIP_NOT_FOUND");
    tripStateMachine.assertTransition(before.status, input.status);
    const after = { status: input.status, updatedAt: new Date() };
    await tx.update(trips).set(after).where(eq(trips.id, input.id));

    const assignedOrders = await tx
      .select()
      .from(orders)
      .where(eq(orders.tripId, before.id))
      .for("update");
    for (const order of assignedOrders) {
      const transitions: Array<{
        from: typeof order.status;
        to: typeof order.status;
        note: string;
      }> = [];
      if (input.status === "DEPARTED" && order.status === "TRIP_ASSIGNED") {
        transitions.push({
          from: "TRIP_ASSIGNED",
          to: "IN_TRANSIT_TO_IRAN",
          note: "سفر از آلمان حرکت کرد",
        });
      } else if (
        input.status === "ARRIVED" &&
        order.status === "IN_TRANSIT_TO_IRAN"
      ) {
        transitions.push(
          {
            from: "IN_TRANSIT_TO_IRAN",
            to: "ARRIVED_IRAN",
            note: "سفارش به ایران رسید",
          },
          {
            from: "ARRIVED_IRAN",
            to: "BALANCE_DUE",
            note: "مانده سفارش آماده پرداخت است",
          },
        );
      } else if (
        input.status === "CANCELLED" &&
        order.status === "TRIP_ASSIGNED"
      ) {
        transitions.push({
          from: "TRIP_ASSIGNED",
          to: "TRIP_PENDING",
          note: "سفر لغو شد و سفارش به صف تخصیص برگشت",
        });
      }
      if (transitions.length === 0) continue;
      for (const transition of transitions) {
        orderStateMachine.assertTransition(transition.from, transition.to);
      }
      const finalStatus = transitions.at(-1)!.to;
      await tx
        .update(orders)
        .set({
          status: finalStatus,
          tripId: input.status === "CANCELLED" ? null : order.tripId,
          updatedAt: after.updatedAt,
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values(
        transitions.map((transition) => ({
          orderId: order.id,
          fromStatus: transition.from,
          toStatus: transition.to,
          actorUserId: input.actorUserId,
          note: transition.note,
        })),
      );
      await tx.insert(outboxEvents).values({
        aggregateType: "order",
        aggregateId: order.id,
        eventType: "order.status_changed",
        payload: {
          orderNumber: order.orderNumber,
          from: order.status,
          to: finalStatus,
          tripId: before.id,
        },
      });
    }

    if (input.status === "PACKED") {
      const linkedItems = await tx
        .select({ id: tripItems.orderItemId })
        .from(tripItems)
        .where(eq(tripItems.tripId, before.id));
      if (linkedItems.length > 0) {
        await tx
          .update(orderItems)
          .set({ procurementStatus: "PACKED", updatedAt: after.updatedAt })
          .where(
            inArray(
              orderItems.id,
              linkedItems.map(({ id }) => id),
            ),
          );
      }
    }
    await audit(
      tx,
      input.actorUserId,
      "trips.status_updated",
      "trip",
      input.id,
      { status: before.status },
      after,
    );
  });
}

export async function updateAdminRetailer(
  db: Database,
  input: {
    id: string;
    actorUserId: string;
    name?: string;
    domain?: string;
    isEnabled: boolean;
    trustTier:
      | "OFFICIAL_BRAND"
      | "AUTHORIZED_RETAILER"
      | "TRUSTED_MARKETPLACE"
      | "UNVERIFIED";
    defaultIntervalMinutes: number;
    termsNotes: string | null;
  },
) {
  if (input.defaultIntervalMinutes < 5 || input.defaultIntervalMinutes > 43_200)
    throw new AdminOperationError("RETAILER_INTERVAL_INVALID");
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(retailers)
      .where(eq(retailers.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("RETAILER_NOT_FOUND");
    const name = input.name?.trim() || before.name;
    const domain = (input.domain?.trim() || before.domain)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (name.length < 2 || name.length > 160 || !/^[a-z0-9.-]+$/.test(domain))
      throw new AdminOperationError("RETAILER_INPUT_INVALID");
    const after = {
      name,
      domain,
      isEnabled: input.isEnabled,
      trustTier: input.trustTier,
      defaultIntervalMinutes: input.defaultIntervalMinutes,
      termsNotes: input.termsNotes?.trim() || null,
      updatedAt: new Date(),
    };
    await tx.update(retailers).set(after).where(eq(retailers.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "sources.retailer_updated",
      "retailer",
      input.id,
      before,
      after,
    );
  });
}

export async function createAdminRetailer(
  db: Database,
  input: Omit<
    Parameters<typeof updateAdminRetailer>[1],
    "id" | "name" | "domain"
  > & { name: string; domain: string },
) {
  const name = input.name.trim();
  const domain = input.domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (
    name.length < 2 ||
    name.length > 160 ||
    !/^[a-z0-9.-]+$/.test(domain) ||
    input.defaultIntervalMinutes < 5 ||
    input.defaultIntervalMinutes > 43_200
  )
    throw new AdminOperationError("RETAILER_INPUT_INVALID");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(retailers)
      .values({
        name,
        domain,
        isEnabled: input.isEnabled,
        trustTier: input.trustTier,
        defaultIntervalMinutes: input.defaultIntervalMinutes,
        termsNotes: input.termsNotes?.trim() || null,
      })
      .returning();
    if (!created) throw new AdminOperationError("RETAILER_NOT_CREATED");
    await audit(
      tx,
      input.actorUserId,
      "sources.retailer_created",
      "retailer",
      created.id,
      null,
      created,
    );
    return created;
  });
}

export async function archiveAdminRetailer(
  db: Database,
  input: { id: string; actorUserId: string },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(retailers)
      .where(eq(retailers.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("RETAILER_NOT_FOUND");
    const after = {
      isEnabled: false,
      trustTier: "UNVERIFIED" as const,
      updatedAt: new Date(),
    };
    await tx.update(retailers).set(after).where(eq(retailers.id, input.id));
    await tx
      .update(sourceOffers)
      .set({ sourceVerified: false, updatedAt: new Date() })
      .where(eq(sourceOffers.retailerId, input.id));
    await audit(
      tx,
      input.actorUserId,
      "sources.retailer_archived",
      "retailer",
      input.id,
      before,
      after,
    );
  });
}

export async function createAdminContent(
  db: Database,
  input: {
    actorUserId: string;
    key: string;
    title: string | null;
    bodyText: string;
  },
) {
  const key = input.key.trim();
  if (
    !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(key) ||
    input.bodyText.trim().length < 2
  )
    throw new AdminOperationError("CONTENT_INPUT_INVALID");
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(contentEntries)
      .values({
        key,
        title: input.title?.trim() || null,
        body: { text: input.bodyText.trim() },
      })
      .returning();
    if (!created) throw new AdminOperationError("CONTENT_NOT_CREATED");
    await audit(
      tx,
      input.actorUserId,
      "content.created",
      "content_entry",
      created.id,
      null,
      { key: created.key, status: created.status },
    );
    return created;
  });
}

export async function updateAdminContentStatus(
  db: Database,
  input: {
    id: string;
    actorUserId: string;
    status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(contentEntries)
      .where(eq(contentEntries.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("CONTENT_NOT_FOUND");
    const after = {
      status: input.status,
      publishedAt:
        input.status === "PUBLISHED"
          ? (before.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    };
    await tx
      .update(contentEntries)
      .set(after)
      .where(eq(contentEntries.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "content.status_updated",
      "content_entry",
      input.id,
      { status: before.status },
      after,
    );
  });
}

export async function updateAdminProductRequest(
  db: Database,
  input: {
    id: string;
    actorUserId: string;
    status: "SUBMITTED" | "IN_RESEARCH" | "QUOTED" | "FULFILLED" | "DECLINED";
  },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(productRequests)
      .where(eq(productRequests.id, input.id))
      .for("update")
      .limit(1);
    if (!before) throw new AdminOperationError("REQUEST_NOT_FOUND");
    const after = {
      status: input.status,
      handledByUserId: input.actorUserId,
      updatedAt: new Date(),
    };
    await tx
      .update(productRequests)
      .set(after)
      .where(eq(productRequests.id, input.id));
    await audit(
      tx,
      input.actorUserId,
      "requests.status_updated",
      "product_request",
      input.id,
      { status: before.status },
      after,
    );
  });
}

export async function receiveOrderInGermany(
  db: Database,
  input: { id: string; actorUserId: string },
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.id))
      .for("update")
      .limit(1);
    if (!order || order.status !== "PURCHASED_GERMANY") {
      throw new AdminOperationError("ORDER_NOT_RECEIVABLE");
    }
    assertOrderTransition(order.status, "RECEIVED_GERMANY", {
      totalLockedToman: order.totalLockedToman,
      depositRequiredToman: order.depositRequiredToman,
      depositPaidToman: order.depositPaidToman,
      balanceDueToman: order.balanceDueToman,
      balancePaidToman: order.balancePaidToman,
    });
    orderStateMachine.assertTransition("RECEIVED_GERMANY", "TRIP_PENDING");
    const now = new Date();
    await tx
      .update(orderItems)
      .set({ procurementStatus: "RECEIVED_GERMANY", updatedAt: now })
      .where(eq(orderItems.orderId, order.id));
    await tx
      .update(orders)
      .set({ status: "TRIP_PENDING", updatedAt: now })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values([
      {
        orderId: order.id,
        fromStatus: "PURCHASED_GERMANY",
        toStatus: "RECEIVED_GERMANY",
        actorUserId: input.actorUserId,
        note: "اقلام در مرکز آلمان دریافت شدند",
      },
      {
        orderId: order.id,
        fromStatus: "RECEIVED_GERMANY",
        toStatus: "TRIP_PENDING",
        actorUserId: input.actorUserId,
        note: "سفارش آماده تخصیص سفر است",
      },
    ]);
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.status_changed",
      payload: {
        orderNumber: order.orderNumber,
        from: order.status,
        to: "TRIP_PENDING",
      },
    });
    await audit(
      tx,
      input.actorUserId,
      "orders.received_germany",
      "order",
      order.id,
      { status: order.status },
      { status: "TRIP_PENDING" },
    );
  });
}

export async function assignOrderToTrip(
  db: Database,
  input: { orderId: string; tripId: string; actorUserId: string },
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .for("update")
      .limit(1);
    const [trip] = await tx
      .select()
      .from(trips)
      .where(eq(trips.id, input.tripId))
      .for("update")
      .limit(1);
    if (
      !order ||
      order.status !== "TRIP_PENDING" ||
      !trip ||
      !["PLANNED", "COLLECTING"].includes(trip.status)
    ) {
      throw new AdminOperationError("TRIP_ASSIGNMENT_INVALID");
    }
    const items = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    if (items.length === 0)
      throw new AdminOperationError("ORDER_ITEMS_MISSING");
    await tx
      .insert(tripItems)
      .values(items.map((item) => ({ tripId: trip.id, orderItemId: item.id })));
    orderStateMachine.assertTransition(order.status, "TRIP_ASSIGNED");
    const now = new Date();
    await tx
      .update(orders)
      .set({ tripId: trip.id, status: "TRIP_ASSIGNED", updatedAt: now })
      .where(eq(orders.id, order.id));
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "TRIP_ASSIGNED",
      actorUserId: input.actorUserId,
      note: `تخصیص به سفر ${trip.code}`,
    });
    await tx.insert(outboxEvents).values({
      aggregateType: "order",
      aggregateId: order.id,
      eventType: "order.status_changed",
      payload: {
        orderNumber: order.orderNumber,
        from: order.status,
        to: "TRIP_ASSIGNED",
        tripId: trip.id,
      },
    });
    await audit(
      tx,
      input.actorUserId,
      "trips.order_assigned",
      "order",
      order.id,
      { tripId: order.tripId, status: order.status },
      { tripId: trip.id, status: "TRIP_ASSIGNED" },
    );
  });
}
