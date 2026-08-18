import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  eurCentsAmount,
  moment,
  primaryId,
  updatedAt,
} from "./columns";
import { sellerTrustStatusEnum, stockStatusEnum, trustTierEnum } from "./enums";
import { productVariants } from "./catalog";

/** A German source retailer and the policy under which we may read it. */
export const retailers = pgTable(
  "retailers",
  {
    id: primaryId(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    country: text("country").notNull().default("DE"),
    trustTier: trustTierEnum("trust_tier").notNull().default("UNVERIFIED"),
    isEnabled: boolean("is_enabled").notNull().default(false),
    /** robots/ToS-derived limits the scraper must obey. Never bypassed. */
    crawlPolicy: jsonb("crawl_policy")
      .$type<{
        readonly allowedPaths?: readonly string[];
        readonly disallowedPaths?: readonly string[];
        readonly maxRequestsPerMinute?: number;
        readonly requiresPlaywright?: boolean;
      }>()
      .notNull()
      .default({}),
    defaultIntervalMinutes: integer("default_interval_minutes")
      .notNull()
      .default(180),
    termsNotes: text("terms_notes"),
    lastHealthStatus: text("last_health_status"),
    lastHealthAt: moment("last_health_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("retailers_domain_unique").on(table.domain),
    index("retailers_enabled_idx").on(table.isEnabled, table.trustTier),
    check(
      "retailers_interval_positive",
      sql`${table.defaultIntervalMinutes} > 0`,
    ),
  ],
);

/**
 * A marketplace seller behind a retailer.
 *
 * Marketplace provenance is seller-level: an approved retailer does not make
 * every seller on it approved.
 */
export const retailerSellers = pgTable(
  "retailer_sellers",
  {
    id: primaryId(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    externalSellerId: text("external_seller_id").notNull(),
    sellerName: text("seller_name"),
    trustStatus: sellerTrustStatusEnum("trust_status")
      .notNull()
      .default("PENDING_REVIEW"),
    reviewNotes: text("review_notes"),
    reviewedAt: moment("reviewed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("retailer_sellers_external_unique").on(
      table.retailerId,
      table.externalSellerId,
    ),
    index("retailer_sellers_trust_idx").on(table.trustStatus),
  ],
);

/**
 * One observed offer from one retailer.
 *
 * `productVariantId` stays null until a human or matcher links the offer to a
 * canonical variant — an unmatched offer must never be sold.
 */
export const sourceOffers = pgTable(
  "source_offers",
  {
    id: primaryId(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id").references(() => retailerSellers.id, {
      onDelete: "set null",
    }),
    externalOfferId: text("external_offer_id"),
    sourceUrl: text("source_url").notNull(),
    productVariantId: uuid("product_variant_id").references(
      () => productVariants.id,
      { onDelete: "set null" },
    ),
    rawTitle: text("raw_title").notNull(),
    sourcePriceEurCents: eurCentsAmount("source_price_eur_cents").notNull(),
    previousPriceEurCents: eurCentsAmount("previous_price_eur_cents"),
    shippingEurCents: eurCentsAmount("shipping_eur_cents"),
    discountBps: integer("discount_bps"),
    stockStatus: stockStatusEnum("stock_status").notNull().default("UNKNOWN"),
    stockQuantity: integer("stock_quantity"),
    sourceIdentifiers: jsonb("source_identifiers")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    sourceImageUrls: jsonb("source_image_urls")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    /** True only when the retailer/seller satisfies the source policy. */
    sourceVerified: boolean("source_verified").notNull().default(false),
    firstSeenAt: moment("first_seen_at").notNull().defaultNow(),
    lastSeenAt: moment("last_seen_at").notNull().defaultNow(),
    expiresAt: moment("expires_at"),
    rawSnapshotId: uuid("raw_snapshot_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("source_offers_external_unique")
      .on(table.retailerId, table.externalOfferId)
      .where(sql`${table.externalOfferId} is not null`),
    uniqueIndex("source_offers_url_unique").on(
      table.retailerId,
      table.sourceUrl,
    ),
    index("source_offers_variant_idx").on(
      table.productVariantId,
      table.stockStatus,
    ),
    index("source_offers_price_idx").on(
      table.stockStatus,
      table.sourcePriceEurCents,
    ),
    index("source_offers_last_seen_idx").on(table.lastSeenAt),
    check(
      "source_offers_price_positive",
      sql`${table.sourcePriceEurCents} > 0`,
    ),
    check(
      "source_offers_shipping_non_negative",
      sql`${table.shippingEurCents} is null or ${table.shippingEurCents} >= 0`,
    ),
    check(
      "source_offers_discount_range",
      sql`${table.discountBps} is null or (${table.discountBps} >= 0 and ${table.discountBps} <= 10000)`,
    ),
    check(
      "source_offers_stock_quantity_non_negative",
      sql`${table.stockQuantity} is null or ${table.stockQuantity} >= 0`,
    ),
    check(
      "source_offers_seen_order",
      sql`${table.lastSeenAt} >= ${table.firstSeenAt}`,
    ),
  ],
);

/** Append-only observation log; the basis for honest price history. */
export const offerPriceHistory = pgTable(
  "offer_price_history",
  {
    id: primaryId(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => sourceOffers.id, { onDelete: "cascade" }),
    priceEurCents: eurCentsAmount("price_eur_cents").notNull(),
    shippingEurCents: eurCentsAmount("shipping_eur_cents"),
    stockStatus: stockStatusEnum("stock_status").notNull(),
    observedAt: moment("observed_at").notNull().defaultNow(),
  },
  (table) => [
    index("offer_price_history_offer_time_idx").on(
      table.offerId,
      table.observedAt,
    ),
    check(
      "offer_price_history_price_positive",
      sql`${table.priceEurCents} > 0`,
    ),
  ],
);

/**
 * Debug/audit metadata for one extraction.
 *
 * Only a content hash and small structured excerpt are kept; full copyrighted
 * pages are deliberately not retained.
 */
export const rawSourceSnapshots = pgTable(
  "raw_source_snapshots",
  {
    id: primaryId(),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    httpStatus: integer("http_status"),
    contentHash: text("content_hash").notNull(),
    extractedFields: jsonb("extracted_fields")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    extractorVersion: text("extractor_version").notNull(),
    capturedAt: moment("captured_at").notNull().defaultNow(),
    purgeAfter: moment("purge_after"),
  },
  (table) => [
    index("raw_source_snapshots_retailer_time_idx").on(
      table.retailerId,
      table.capturedAt,
    ),
    index("raw_source_snapshots_hash_idx").on(table.contentHash),
  ],
);
