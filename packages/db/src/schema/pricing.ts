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
  tomanAmount,
  updatedAt,
} from "./columns";
import { brands, categories, products } from "./catalog";
import {
  pricingRuleScopeEnum,
  quoteStatusEnum,
  transportClassEnum,
  trustTierEnum,
} from "./enums";
import { sourceOffers } from "./sourcing";
import { users } from "./identity";

/**
 * One observed FX rate.
 *
 * Stored as integer Toman per one unit of the base currency. Every quote keeps
 * the id of the exact snapshot it used, so a price can always be re-explained.
 */
export const fxRates = pgTable(
  "fx_rates",
  {
    id: primaryId(),
    provider: text("provider").notNull(),
    baseCurrency: text("base_currency").notNull().default("EUR"),
    quoteCurrency: text("quote_currency").notNull().default("TOMAN"),
    side: text("side").notNull().default("SELL"),
    tomanPerUnit: tomanAmount("toman_per_unit").notNull(),
    providerTimestamp: moment("provider_timestamp").notNull(),
    fetchedAt: moment("fetched_at").notNull().defaultNow(),
    rawReference: jsonb("raw_reference")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("fx_rates_lookup_idx").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.side,
      table.providerTimestamp,
    ),
    check("fx_rates_positive", sql`${table.tomanPerUnit} > 0`),
    check("fx_rates_side_valid", sql`${table.side} in ('BUY', 'SELL')`),
  ],
);

/**
 * A pricing rule. The engine resolves the most specific active rule; ties are
 * broken by descending priority.
 */
export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: primaryId(),
    scope: pricingRuleScopeEnum("scope").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    trustTier: trustTierEnum("trust_tier"),
    priceBandMinEurCents: eurCentsAmount("price_band_min_eur_cents"),
    priceBandMaxEurCents: eurCentsAmount("price_band_max_eur_cents"),
    priority: integer("priority").notNull().default(0),
    targetMarginBps: integer("target_margin_bps").notNull(),
    minProfitToman: tomanAmount("min_profit_toman").notNull(),
    transportClass: transportClassEnum("transport_class").notNull(),
    customsRiskBps: integer("customs_risk_bps").notNull().default(0),
    fxBufferBps: integer("fx_buffer_bps").notNull().default(0),
    paymentFeeBps: integer("payment_fee_bps").notNull().default(0),
    depositBps: integer("deposit_bps").notNull(),
    minDepositToman: tomanAmount("min_deposit_toman")
      .notNull()
      .default(sql`0`),
    roundingUnitToman: tomanAmount("rounding_unit_toman")
      .notNull()
      .default(sql`10000`),
    activeFrom: moment("active_from").notNull().defaultNow(),
    activeTo: moment("active_to"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("pricing_rules_resolution_idx").on(
      table.scope,
      table.priority,
      table.activeFrom,
    ),
    index("pricing_rules_category_idx").on(table.categoryId),
    index("pricing_rules_brand_idx").on(table.brandId),
    check(
      "pricing_rules_margin_range",
      sql`${table.targetMarginBps} >= 0 and ${table.targetMarginBps} < 10000`,
    ),
    check(
      "pricing_rules_deposit_range",
      sql`${table.depositBps} > 0 and ${table.depositBps} <= 10000`,
    ),
    check(
      "pricing_rules_fee_range",
      sql`${table.paymentFeeBps} >= 0 and ${table.paymentFeeBps} < 10000`,
    ),
    check(
      "pricing_rules_margin_plus_fee",
      sql`${table.targetMarginBps} + ${table.paymentFeeBps} < 10000`,
    ),
    check(
      "pricing_rules_rounding_positive",
      sql`${table.roundingUnitToman} > 0`,
    ),
    check(
      "pricing_rules_active_window",
      sql`${table.activeTo} is null or ${table.activeTo} > ${table.activeFrom}`,
    ),
    check(
      "pricing_rules_price_band_order",
      sql`${table.priceBandMinEurCents} is null or ${table.priceBandMaxEurCents} is null or ${table.priceBandMaxEurCents} > ${table.priceBandMinEurCents}`,
    ),
    // A scoped rule must actually carry the target it claims to scope to.
    check(
      "pricing_rules_scope_target",
      sql`(${table.scope} <> 'CATEGORY' or ${table.categoryId} is not null)
        and (${table.scope} <> 'BRAND' or ${table.brandId} is not null)
        and (${table.scope} <> 'PRODUCT' or ${table.productId} is not null)
        and (${table.scope} <> 'TRUST_TIER' or ${table.trustTier} is not null)
        and (${table.scope} <> 'PRICE_BAND' or ${table.priceBandMinEurCents} is not null or ${table.priceBandMaxEurCents} is not null)`,
    ),
  ],
);

/**
 * An immutable short-lived price proposal.
 *
 * Nothing in this row may be recalculated after creation: the order locks
 * against it, and the FX snapshot plus rule ids make it fully auditable.
 */
export const quotes = pgTable(
  "quotes",
  {
    id: primaryId(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id"),
    /**
     * Null for a quote whose lines are all manually priced in Toman: there is
     * no EUR conversion to snapshot, and inventing one would be a lie.
     */
    fxRateId: uuid("fx_rate_id").references(() => fxRates.id, {
      onDelete: "restrict",
    }),
    fxTomanPerEur: tomanAmount("fx_toman_per_eur"),
    subtotalToman: tomanAmount("subtotal_toman").notNull(),
    finalToman: tomanAmount("final_toman").notNull(),
    depositToman: tomanAmount("deposit_toman").notNull(),
    balanceToman: tomanAmount("balance_toman").notNull(),
    appliedRuleIds: jsonb("applied_rule_ids")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    calculationVersion: text("calculation_version").notNull(),
    status: quoteStatusEnum("status").notNull().default("ACTIVE"),
    expiresAt: moment("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("quotes_user_created_idx").on(table.userId, table.createdAt),
    index("quotes_status_expiry_idx").on(table.status, table.expiresAt),
    check(
      "quotes_amounts_non_negative",
      sql`${table.subtotalToman} >= 0
      and ${table.finalToman} >= 0
      and ${table.depositToman} >= 0
      and ${table.balanceToman} >= 0`,
    ),
    check(
      "quotes_deposit_within_total",
      sql`${table.depositToman} <= ${table.finalToman}`,
    ),
    // The split must reconstruct the total exactly; no rounding may leak.
    check(
      "quotes_split_balances",
      sql`${table.depositToman} + ${table.balanceToman} = ${table.finalToman}`,
    ),
  ],
);

/** Per-line cost breakdown retained for audit and admin explanation. */
export const quoteItems = pgTable(
  "quote_items",
  {
    id: primaryId(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    sourceOfferId: uuid("source_offer_id").references(() => sourceOffers.id, {
      onDelete: "set null",
    }),
    productVariantId: uuid("product_variant_id"),
    quantity: integer("quantity").notNull(),
    sourcePriceEurCents: eurCentsAmount("source_price_eur_cents").notNull(),
    shippingEurCents: eurCentsAmount("shipping_eur_cents")
      .notNull()
      .default(sql`0`),
    sourceTomanTotal: tomanAmount("source_toman_total").notNull(),
    transportToman: tomanAmount("transport_toman")
      .notNull()
      .default(sql`0`),
    customsRiskToman: tomanAmount("customs_risk_toman")
      .notNull()
      .default(sql`0`),
    localDeliveryToman: tomanAmount("local_delivery_toman")
      .notNull()
      .default(sql`0`),
    paymentFeeToman: tomanAmount("payment_fee_toman")
      .notNull()
      .default(sql`0`),
    marginToman: tomanAmount("margin_toman")
      .notNull()
      .default(sql`0`),
    lineTotalToman: tomanAmount("line_total_toman").notNull(),
    breakdown: jsonb("breakdown")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    observedAt: moment("observed_at").notNull().defaultNow(),
  },
  (table) => [
    index("quote_items_quote_idx").on(table.quoteId),
    check("quote_items_quantity_positive", sql`${table.quantity} > 0`),
    check("quote_items_line_total_positive", sql`${table.lineTotalToman} > 0`),
  ],
);

/** Toggle for regulated categories and staged features. */
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: primaryId(),
    key: text("key").notNull(),
    description: text("description"),
    isEnabled: boolean("is_enabled").notNull().default(false),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("feature_flags_key_unique").on(table.key)],
);
