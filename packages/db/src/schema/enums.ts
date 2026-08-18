/**
 * PostgreSQL enums derived from the canonical domain enums.
 *
 * Every enum here is built directly from `@rava/domain`, so a status can never
 * drift between the TypeScript union and the database type.
 */

import {
  ALERT_STATUSES,
  AUTHENTICITY_STATUSES,
  CART_STATUSES,
  CONTENT_STATUSES,
  DELIVERY_STATUSES,
  EVIDENCE_STATUSES,
  MEDIA_KINDS,
  MODERATION_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  ORDER_ITEM_PROCUREMENT_STATUSES,
  ORDER_STATUSES,
  OUTBOX_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PRICING_RULE_SCOPES,
  PRODUCT_REQUEST_STATUSES,
  PRODUCT_STATUSES,
  PUBLICATION_CHANNELS,
  PUBLICATION_STATUSES,
  PURCHASE_TASK_STATUSES,
  QUOTE_STATUSES,
  SCRAPER_RUN_STATUSES,
  SELLER_TRUST_STATUSES,
  STOCK_STATUSES,
  TRANSPORT_CLASSES,
  TRIP_STATUSES,
  TRUST_TIERS,
  USER_ROLES,
  USER_STATUSES,
  VARIANT_STATUSES,
} from "@rava/domain";
import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const userStatusEnum = pgEnum("user_status", USER_STATUSES);
export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);
export const variantStatusEnum = pgEnum("variant_status", VARIANT_STATUSES);
export const mediaKindEnum = pgEnum("media_kind", MEDIA_KINDS);
export const trustTierEnum = pgEnum("trust_tier", TRUST_TIERS);
export const sellerTrustStatusEnum = pgEnum(
  "seller_trust_status",
  SELLER_TRUST_STATUSES,
);
export const stockStatusEnum = pgEnum("stock_status", STOCK_STATUSES);
export const transportClassEnum = pgEnum("transport_class", TRANSPORT_CLASSES);
export const pricingRuleScopeEnum = pgEnum(
  "pricing_rule_scope",
  PRICING_RULE_SCOPES,
);
export const quoteStatusEnum = pgEnum("quote_status", QUOTE_STATUSES);
export const cartStatusEnum = pgEnum("cart_status", CART_STATUSES);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const orderItemProcurementStatusEnum = pgEnum(
  "order_item_procurement_status",
  ORDER_ITEM_PROCUREMENT_STATUSES,
);
export const authenticityStatusEnum = pgEnum(
  "authenticity_status",
  AUTHENTICITY_STATUSES,
);
export const paymentTypeEnum = pgEnum("payment_type", PAYMENT_TYPES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const purchaseTaskStatusEnum = pgEnum(
  "purchase_task_status",
  PURCHASE_TASK_STATUSES,
);
export const evidenceStatusEnum = pgEnum("evidence_status", EVIDENCE_STATUSES);
export const tripStatusEnum = pgEnum("trip_status", TRIP_STATUSES);
export const deliveryStatusEnum = pgEnum("delivery_status", DELIVERY_STATUSES);
export const alertStatusEnum = pgEnum("alert_status", ALERT_STATUSES);
export const productRequestStatusEnum = pgEnum(
  "product_request_status",
  PRODUCT_REQUEST_STATUSES,
);
export const moderationStatusEnum = pgEnum(
  "moderation_status",
  MODERATION_STATUSES,
);
export const contentStatusEnum = pgEnum("content_status", CONTENT_STATUSES);
export const publicationChannelEnum = pgEnum(
  "publication_channel",
  PUBLICATION_CHANNELS,
);
export const publicationStatusEnum = pgEnum(
  "publication_status",
  PUBLICATION_STATUSES,
);
export const scraperRunStatusEnum = pgEnum(
  "scraper_run_status",
  SCRAPER_RUN_STATUSES,
);
export const outboxStatusEnum = pgEnum("outbox_status", OUTBOX_STATUSES);
export const notificationChannelEnum = pgEnum(
  "notification_channel",
  NOTIFICATION_CHANNELS,
);
export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  NOTIFICATION_DELIVERY_STATUSES,
);
