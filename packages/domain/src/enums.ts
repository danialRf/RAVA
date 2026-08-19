/**
 * Canonical domain enums.
 *
 * These arrays are the single source of truth: the Drizzle schema builds its
 * PostgreSQL enums from them, so a value can never exist in code without
 * existing in the database (and vice versa).
 *
 * Raw enum names are internal. Customer-facing wording lives in the UI layer.
 */

export const USER_ROLES = [
  "CUSTOMER",
  "OWNER",
  "ADMIN",
  "MERCHANDISER",
  "BUYER_GERMANY",
  "SUPPORT",
  "FINANCE",
  "CONTENT_EDITOR",
  /** Kept for existing installations; new staff accounts use a specific role. */
  "OPERATOR",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRODUCT_STATUSES = [
  "DRAFT",
  "NEEDS_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const MEDIA_KINDS = [
  "PRIMARY",
  "GALLERY",
  "SWATCH",
  "MARKETING_CARD",
  "DOCUMENT",
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** How much the sourcing policy trusts a retailer. Drives pricing and review. */
export const TRUST_TIERS = [
  "OFFICIAL_BRAND",
  "AUTHORIZED_RETAILER",
  "TRUSTED_MARKETPLACE",
  "UNVERIFIED",
] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const SELLER_TRUST_STATUSES = [
  "APPROVED",
  "PENDING_REVIEW",
  "REJECTED",
] as const;
export type SellerTrustStatus = (typeof SELLER_TRUST_STATUSES)[number];

/** UNKNOWN is deliberate: never fabricate stock we did not observe. */
export const STOCK_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "PREORDER",
  "UNKNOWN",
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const TRANSPORT_CLASSES = ["XS", "S", "M", "L", "BLOCKED"] as const;
export type TransportClass = (typeof TRANSPORT_CLASSES)[number];

export const PRICING_RULE_SCOPES = [
  "GLOBAL",
  "CATEGORY",
  "BRAND",
  "PRICE_BAND",
  "TRUST_TIER",
  "PRODUCT",
] as const;
export type PricingRuleScope = (typeof PRICING_RULE_SCOPES)[number];

export const QUOTE_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "CONSUMED",
  "CANCELLED",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const CART_STATUSES = ["ACTIVE", "CONVERTED", "ABANDONED"] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

/** Full operational order lifecycle from docs/OPERATIONAL_STATUS_MODEL.md. */
export const ORDER_STATUSES = [
  "DRAFT",
  "QUOTE_PENDING",
  "QUOTED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "PROCUREMENT_PENDING",
  "PROCUREMENT_IN_PROGRESS",
  "CUSTOMER_RECONFIRMATION_REQUIRED",
  "PURCHASED_GERMANY",
  "RECEIVED_GERMANY",
  "TRIP_PENDING",
  "TRIP_ASSIGNED",
  "IN_TRANSIT_TO_IRAN",
  "ARRIVED_IRAN",
  "BALANCE_DUE",
  "BALANCE_PAID",
  "LOCAL_DELIVERY_PENDING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_PROCUREMENT_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "PURCHASED",
  "RECEIVED_GERMANY",
  "PACKED",
  "UNAVAILABLE",
  "CANCELLED",
] as const;
export type OrderItemProcurementStatus =
  (typeof ORDER_ITEM_PROCUREMENT_STATUSES)[number];

/**
 * Authenticity wording is legally sensitive. SOURCE_VERIFIED only states that
 * the source policy was satisfied; it never claims physical authentication.
 */
export const AUTHENTICITY_STATUSES = [
  "UNKNOWN",
  "SOURCE_VERIFIED",
  "MANUAL_REVIEW_REQUIRED",
  "RAVA_AUTHENTICITY_GUARANTEE",
  "REJECTED",
] as const;
export type AuthenticityStatus = (typeof AUTHENTICITY_STATUSES)[number];

export const PAYMENT_TYPES = ["DEPOSIT", "BALANCE", "REFUND"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ["GATEWAY", "CARD_TO_CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "INITIATED",
  "PENDING_VERIFICATION",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REVERSED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PURCHASE_TASK_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "CANCELLED",
] as const;
export type PurchaseTaskStatus = (typeof PURCHASE_TASK_STATUSES)[number];

export const EVIDENCE_STATUSES = [
  "MISSING",
  "PARTIAL",
  "COMPLETE",
  "REJECTED",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const TRIP_STATUSES = [
  "PLANNED",
  "COLLECTING",
  "PACKED",
  "DEPARTED",
  "ARRIVED",
  "DISTRIBUTED",
  "CANCELLED",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const DELIVERY_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RETURNED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const ALERT_STATUSES = ["ACTIVE", "TRIGGERED", "CANCELLED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const PRODUCT_REQUEST_STATUSES = [
  "SUBMITTED",
  "IN_RESEARCH",
  "QUOTED",
  "FULFILLED",
  "DECLINED",
] as const;
export type ProductRequestStatus = (typeof PRODUCT_REQUEST_STATUSES)[number];

export const MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const CONTENT_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const PUBLICATION_CHANNELS = ["WEBSITE", "TELEGRAM"] as const;
export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

export const PUBLICATION_STATUSES = [
  "QUEUED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "WITHDRAWN",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const SCRAPER_RUN_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
  "ABORTED",
] as const;
export type ScraperRunStatus = (typeof SCRAPER_RUN_STATUSES)[number];

export const OUTBOX_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const NOTIFICATION_CHANNELS = [
  "SMS",
  "EMAIL",
  "TELEGRAM",
  "IN_APP",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  "QUEUED",
  "SENT",
  "FAILED",
  "SUPPRESSED",
] as const;
export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];
