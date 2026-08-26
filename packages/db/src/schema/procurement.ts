import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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
import { orderItems, orders } from "./commerce";
import {
  deliveryStatusEnum,
  evidenceStatusEnum,
  purchaseTaskStatusEnum,
} from "./enums";
import { addresses, users } from "./identity";
import { trips } from "./logistics";
import { retailerSellers, retailers } from "./sourcing";

/** Work item for a buyer in Germany. */
export const purchaseTasks = pgTable(
  "purchase_tasks",
  {
    id: primaryId(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceUrl: text("source_url").notNull(),
    /** Hard ceiling: buying above this requires customer reconfirmation. */
    targetMaxPriceEurCents: eurCentsAmount(
      "target_max_price_eur_cents",
    ).notNull(),
    dueAt: moment("due_at"),
    status: purchaseTaskStatusEnum("status").notNull().default("OPEN"),
    blockedReason: text("blocked_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("purchase_tasks_status_due_idx").on(table.status, table.dueAt),
    index("purchase_tasks_assignee_idx").on(table.assignedToUserId),
    uniqueIndex("purchase_tasks_open_per_item")
      .on(table.orderItemId)
      .where(sql`${table.status} not in ('COMPLETED', 'CANCELLED')`),
    check(
      "purchase_tasks_target_price_positive",
      sql`${table.targetMaxPriceEurCents} > 0`,
    ),
  ],
);

/** A completed purchase from a source retailer. */
export const purchases = pgTable(
  "purchases",
  {
    id: primaryId(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    purchaseTaskId: uuid("purchase_task_id").references(
      () => purchaseTasks.id,
      { onDelete: "set null" },
    ),
    buyerUserId: uuid("buyer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    retailerId: uuid("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "restrict" }),
    sellerId: uuid("seller_id").references(() => retailerSellers.id, {
      onDelete: "set null",
    }),
    purchaseEurCents: eurCentsAmount("purchase_eur_cents").notNull(),
    shippingEurCents: eurCentsAmount("shipping_eur_cents")
      .notNull()
      .default(sql`0`),
    purchasedAt: moment("purchased_at").notNull().defaultNow(),
    /** Full reference stays internal; the masked form may be shown publicly. */
    retailerOrderRef: text("retailer_order_ref"),
    retailerOrderRefMasked: text("retailer_order_ref_masked"),
    evidenceStatus: evidenceStatusEnum("evidence_status")
      .notNull()
      .default("MISSING"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("purchases_order_item_idx").on(table.orderItemId),
    uniqueIndex("purchases_task_unique")
      .on(table.purchaseTaskId)
      .where(sql`${table.purchaseTaskId} is not null`),
    index("purchases_retailer_time_idx").on(
      table.retailerId,
      table.purchasedAt,
    ),
    check("purchases_amount_positive", sql`${table.purchaseEurCents} > 0`),
    check(
      "purchases_shipping_non_negative",
      sql`${table.shippingEurCents} >= 0`,
    ),
  ],
);

/** Private receipt/invoice file backing an authenticity claim. */
export const purchaseDocuments = pgTable(
  "purchase_documents",
  {
    id: primaryId(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    index("purchase_documents_purchase_idx").on(table.purchaseId),
    check("purchase_documents_size_positive", sql`${table.byteSize} > 0`),
  ],
);

export const tripItems = pgTable(
  "trip_items",
  {
    id: primaryId(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    packedWeightGrams: integer("packed_weight_grams"),
    createdAt: createdAt(),
  },
  (table) => [
    // An order item can only travel on one trip at a time.
    uniqueIndex("trip_items_order_item_unique").on(table.orderItemId),
    index("trip_items_trip_idx").on(table.tripId),
    check(
      "trip_items_weight_positive",
      sql`${table.packedWeightGrams} is null or ${table.packedWeightGrams} > 0`,
    ),
  ],
);

/** Final courier leg inside Iran. */
export const localDeliveries = pgTable(
  "local_deliveries",
  {
    id: primaryId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    addressId: uuid("address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    courier: text("courier"),
    trackingCode: text("tracking_code"),
    status: deliveryStatusEnum("status").notNull().default("PENDING"),
    scheduledFor: moment("scheduled_for"),
    deliveredAt: moment("delivered_at"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("local_deliveries_order_idx").on(table.orderId),
    index("local_deliveries_status_idx").on(table.status, table.scheduledFor),
    check(
      "local_deliveries_delivered_timestamp",
      sql`${table.status} <> 'DELIVERED' or ${table.deliveredAt} is not null`,
    ),
  ],
);
