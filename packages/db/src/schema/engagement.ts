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
  moment,
  primaryId,
  tomanAmount,
  updatedAt,
} from "./columns";
import { productVariants, products } from "./catalog";
import { orders } from "./commerce";
import {
  alertStatusEnum,
  moderationStatusEnum,
  notificationChannelEnum,
  notificationDeliveryStatusEnum,
  productRequestStatusEnum,
} from "./enums";
import { users } from "./identity";
import { privateUploads } from "./uploads";
import { sourceOffers } from "./sourcing";

export const wishlists = pgTable(
  "wishlists",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("wishlists_user_product_unique").on(
      table.userId,
      table.productId,
    ),
  ],
);

export const recentlyViewed = pgTable(
  "recently_viewed",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    viewedAt: moment("viewed_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("recently_viewed_user_product_unique").on(
      table.userId,
      table.productId,
    ),
    index("recently_viewed_user_time_idx").on(table.userId, table.viewedAt),
  ],
);

/** Notify when the estimated Toman price falls to or below the threshold. */
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    thresholdToman: tomanAmount("threshold_toman").notNull(),
    status: alertStatusEnum("status").notNull().default("ACTIVE"),
    triggeredAt: moment("triggered_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("price_alerts_active_unique")
      .on(table.userId, table.productId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("price_alerts_threshold_idx")
      .on(table.productId, table.thresholdToman)
      .where(sql`${table.status} = 'ACTIVE'`),
    check("price_alerts_threshold_positive", sql`${table.thresholdToman} > 0`),
  ],
);

export const stockAlerts = pgTable(
  "stock_alerts",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    status: alertStatusEnum("status").notNull().default("ACTIVE"),
    triggeredAt: moment("triggered_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("stock_alerts_active_unique")
      .on(table.userId, table.productVariantId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("stock_alerts_variant_idx")
      .on(table.productVariantId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    topic: text("topic").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("notification_preferences_unique").on(
      table.userId,
      table.channel,
      table.topic,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: primaryId(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    topic: text("topic").notNull(),
    status: notificationDeliveryStatusEnum("status")
      .notNull()
      .default("QUEUED"),
    providerReference: text("provider_reference"),
    /** Never contains OTP codes or payment secrets. */
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    sentAt: moment("sent_at"),
  },
  (table) => [
    index("notification_deliveries_user_time_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("notification_deliveries_status_idx").on(table.status),
  ],
);

/** "Find it for me" request when the catalog does not carry the product. */
export const productRequests = pgTable(
  "product_requests",
  {
    id: primaryId(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactPhoneE164: text("contact_phone_e164"),
    descriptionFa: text("description_fa").notNull(),
    referenceUrl: text("reference_url"),
    budgetToman: tomanAmount("budget_toman"),
    /** Private storage object; readable by staff only, never public. */
    imageUploadId: uuid("image_upload_id").references(() => privateUploads.id, {
      onDelete: "set null",
    }),
    status: productRequestStatusEnum("status").notNull().default("SUBMITTED"),
    handledByUserId: uuid("handled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("product_requests_status_idx").on(table.status, table.createdAt),
    check(
      "product_requests_budget_positive",
      sql`${table.budgetToman} is null or ${table.budgetToman} > 0`,
    ),
  ],
);

export const productRequestCandidates = pgTable(
  "product_request_candidates",
  {
    id: primaryId(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => productRequests.id, { onDelete: "cascade" }),
    sourceOfferId: uuid("source_offer_id").references(() => sourceOffers.id, {
      onDelete: "set null",
    }),
    proposedUrl: text("proposed_url"),
    estimatedToman: tomanAmount("estimated_toman"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    index("product_request_candidates_request_idx").on(table.requestId),
  ],
);

/** Reviews are tied to a delivered order so ratings cannot be fabricated. */
export const reviews = pgTable(
  "reviews",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    bodyFa: text("body_fa"),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("PENDING"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("reviews_user_product_unique").on(
      table.userId,
      table.productId,
    ),
    index("reviews_product_status_idx").on(
      table.productId,
      table.moderationStatus,
    ),
    check(
      "reviews_rating_range",
      sql`${table.rating} >= 1 and ${table.rating} <= 5`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    bodyFa: text("body_fa").notNull(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("PENDING"),
    createdAt: createdAt(),
  },
  (table) => [
    index("questions_product_status_idx").on(
      table.productId,
      table.moderationStatus,
    ),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: primaryId(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isStaffAnswer: boolean("is_staff_answer").notNull().default(false),
    bodyFa: text("body_fa").notNull(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("PENDING"),
    createdAt: createdAt(),
  },
  (table) => [index("answers_question_idx").on(table.questionId)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: primaryId(),
    code: text("code").notNull(),
    discountBps: integer("discount_bps"),
    discountToman: tomanAmount("discount_toman"),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    activeFrom: moment("active_from").notNull().defaultNow(),
    activeTo: moment("active_to"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("coupons_code_unique").on(table.code),
    check(
      "coupons_discount_present",
      sql`(${table.discountBps} is not null) <> (${table.discountToman} is not null)`,
    ),
    check(
      "coupons_bps_range",
      sql`${table.discountBps} is null or (${table.discountBps} > 0 and ${table.discountBps} <= 10000)`,
    ),
    check(
      "coupons_redemptions_within_max",
      sql`${table.maxRedemptions} is null or ${table.redemptionCount} <= ${table.maxRedemptions}`,
    ),
  ],
);

export const referrals = pgTable(
  "referrals",
  {
    id: primaryId(),
    referrerUserId: uuid("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredUserId: uuid("referred_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    code: text("code").notNull(),
    convertedAt: moment("converted_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("referrals_code_unique").on(table.code),
    index("referrals_referrer_idx").on(table.referrerUserId),
    check(
      "referrals_no_self_referral",
      sql`${table.referredUserId} is null or ${table.referredUserId} <> ${table.referrerUserId}`,
    ),
  ],
);

/** Append-only loyalty points ledger. Balances are derived, never stored. */
export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("loyalty_ledger_user_time_idx").on(table.userId, table.createdAt),
    check("loyalty_ledger_points_non_zero", sql`${table.points} <> 0`),
  ],
);
