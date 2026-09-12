import { sql } from "drizzle-orm";
import {
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
import { productVariants } from "./catalog";
import {
  authenticityStatusEnum,
  cartStatusEnum,
  orderItemProcurementStatusEnum,
  orderStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  paymentTypeEnum,
  stockStatusEnum,
} from "./enums";
import { addresses, users } from "./identity";
import { trips } from "./logistics";
import { quotes } from "./pricing";
import { sourceOffers } from "./sourcing";

export const carts = pgTable(
  "carts",
  {
    id: primaryId(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousKey: text("anonymous_key"),
    status: cartStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("carts_user_idx").on(table.userId, table.status),
    uniqueIndex("carts_anonymous_key_unique")
      .on(table.anonymousKey)
      .where(sql`${table.anonymousKey} is not null`),
    check(
      "carts_owner_present",
      sql`${table.userId} is not null or ${table.anonymousKey} is not null`,
    ),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: primaryId(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    sourceOfferId: uuid("source_offer_id").references(() => sourceOffers.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("cart_items_variant_unique").on(
      table.cartId,
      table.productVariantId,
    ),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

/**
 * A customer order.
 *
 * All money is locked in Toman at quote time. `depositPaidToman` and
 * `balancePaidToman` are maintained from successful payments only, and the
 * domain guards in `@rava/domain` refuse status changes that contradict them.
 */
export const orders = pgTable(
  "orders",
  {
    id: primaryId(),
    orderNumber: text("order_number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "restrict",
    }),
    shippingAddressId: uuid("shipping_address_id").references(
      () => addresses.id,
      { onDelete: "restrict" },
    ),
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    totalLockedToman: tomanAmount("total_locked_toman").notNull(),
    depositRequiredToman: tomanAmount("deposit_required_toman").notNull(),
    depositPaidToman: tomanAmount("deposit_paid_toman")
      .notNull()
      .default(sql`0`),
    balanceDueToman: tomanAmount("balance_due_toman").notNull(),
    balancePaidToman: tomanAmount("balance_paid_toman")
      .notNull()
      .default(sql`0`),
    displayCurrency: text("display_currency").notNull().default("TOMAN"),
    expectedDeliveryStart: moment("expected_delivery_start"),
    expectedDeliveryEnd: moment("expected_delivery_end"),
    tripId: uuid("trip_id").references(() => trips.id, {
      onDelete: "set null",
    }),
    placedAt: moment("placed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    index("orders_user_created_idx").on(table.userId, table.createdAt),
    index("orders_status_idx").on(table.status),
    index("orders_trip_idx").on(table.tripId),
    check(
      "orders_amounts_non_negative",
      sql`${table.totalLockedToman} >= 0
        and ${table.depositRequiredToman} >= 0
        and ${table.depositPaidToman} >= 0
        and ${table.balanceDueToman} >= 0
        and ${table.balancePaidToman} >= 0`,
    ),
    check(
      "orders_split_balances",
      sql`${table.depositRequiredToman} + ${table.balanceDueToman} = ${table.totalLockedToman}`,
    ),
    check(
      "orders_paid_within_total",
      sql`${table.depositPaidToman} + ${table.balancePaidToman} <= ${table.totalLockedToman}`,
    ),
    check(
      "orders_delivery_window_order",
      sql`${table.expectedDeliveryStart} is null
        or ${table.expectedDeliveryEnd} is null
        or ${table.expectedDeliveryEnd} >= ${table.expectedDeliveryStart}`,
    ),
  ],
);

/**
 * One ordered line with snapshots.
 *
 * The catalog and offer snapshots are frozen copies: if the retailer later
 * changes the title or price, what the customer bought stays truthful.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: primaryId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id").references(
      () => productVariants.id,
      { onDelete: "set null" },
    ),
    sourceOfferId: uuid("source_offer_id").references(() => sourceOffers.id, {
      onDelete: "set null",
    }),
    productSnapshot: jsonb("product_snapshot")
      .$type<{
        readonly titleFa: string;
        readonly titleOriginal: string;
        readonly brand: string;
        readonly variant: Record<string, string>;
      }>()
      .notNull(),
    /** Null for a manually priced line: no source offer was involved. */
    offerSnapshot: jsonb("offer_snapshot").$type<{
      readonly retailer: string;
      readonly sourceUrl: string;
      readonly priceEurCents: string;
      readonly observedAt: string;
    }>(),
    quantity: integer("quantity").notNull(),
    unitTotalToman: tomanAmount("unit_total_toman").notNull(),
    lineTotalToman: tomanAmount("line_total_toman").notNull(),
    maxSourcePriceEurCents: eurCentsAmount("max_source_price_eur_cents"),
    procurementStatus: orderItemProcurementStatusEnum("procurement_status")
      .notNull()
      .default("PENDING"),
    sourceStockStatus: stockStatusEnum("source_stock_status")
      .notNull()
      .default("UNKNOWN"),
    authenticityStatus: authenticityStatusEnum("authenticity_status")
      .notNull()
      .default("UNKNOWN"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_procurement_idx").on(table.procurementStatus),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_items_line_total_matches",
      sql`${table.lineTotalToman} = ${table.unitTotalToman} * ${table.quantity}`,
    ),
  ],
);

/** Append-only milestone log shown to customers and admins. */
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: primaryId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    index("order_status_history_order_time_idx").on(
      table.orderId,
      table.createdAt,
    ),
    check(
      "order_status_history_changes_state",
      sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`,
    ),
  ],
);

/**
 * A payment attempt.
 *
 * `idempotencyKey` is unique so a repeated gateway callback can never capture
 * the same money twice.
 */
export const payments = pgTable(
  "payments",
  {
    id: primaryId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    type: paymentTypeEnum("type").notNull(),
    method: paymentMethodEnum("method").notNull(),
    provider: text("provider").notNull(),
    amountToman: tomanAmount("amount_toman").notNull(),
    providerAuthority: text("provider_authority"),
    providerReference: text("provider_reference"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: paymentStatusEnum("status").notNull().default("INITIATED"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    verifiedAt: moment("verified_at"),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("payments_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("payments_provider_reference_unique")
      .on(table.provider, table.providerReference)
      .where(sql`${table.providerReference} is not null`),
    index("payments_order_idx").on(table.orderId, table.type),
    index("payments_status_idx").on(table.status),
    check("payments_amount_positive", sql`${table.amountToman} > 0`),
    check(
      "payments_verified_when_succeeded",
      sql`${table.status} <> 'SUCCEEDED' or ${table.verifiedAt} is not null`,
    ),
  ],
);

/** Private card-to-card receipt upload awaiting operator verification. */
export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: primaryId(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    /** Key in the private bucket. Never served publicly. */
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (table) => [
    index("payment_receipts_payment_idx").on(table.paymentId),
    check("payment_receipts_size_positive", sql`${table.byteSize} > 0`),
  ],
);
