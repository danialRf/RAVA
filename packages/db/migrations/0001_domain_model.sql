CREATE TYPE "public"."alert_status" AS ENUM('ACTIVE', 'TRIGGERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."authenticity_status" AS ENUM('UNKNOWN', 'SOURCE_VERIFIED', 'MANUAL_REVIEW_REQUIRED', 'RAVA_AUTHENTICITY_GUARANTEE', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CONVERTED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('MISSING', 'PARTIAL', 'COMPLETE', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('PRIMARY', 'GALLERY', 'SWATCH', 'MARKETING_CARD', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('SMS', 'EMAIL', 'TELEGRAM', 'IN_APP');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('QUEUED', 'SENT', 'FAILED', 'SUPPRESSED');--> statement-breakpoint
CREATE TYPE "public"."order_item_procurement_status" AS ENUM('PENDING', 'ASSIGNED', 'PURCHASED', 'RECEIVED_GERMANY', 'PACKED', 'UNAVAILABLE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'QUOTE_PENDING', 'QUOTED', 'DEPOSIT_PENDING', 'DEPOSIT_PAID', 'PROCUREMENT_PENDING', 'PROCUREMENT_IN_PROGRESS', 'CUSTOMER_RECONFIRMATION_REQUIRED', 'PURCHASED_GERMANY', 'RECEIVED_GERMANY', 'TRIP_PENDING', 'TRIP_ASSIGNED', 'IN_TRANSIT_TO_IRAN', 'ARRIVED_IRAN', 'BALANCE_DUE', 'BALANCE_PAID', 'LOCAL_DELIVERY_PENDING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('GATEWAY', 'CARD_TO_CARD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('INITIATED', 'PENDING_VERIFICATION', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('DEPOSIT', 'BALANCE', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."pricing_rule_scope" AS ENUM('GLOBAL', 'CATEGORY', 'BRAND', 'PRICE_BAND', 'TRUST_TIER', 'PRODUCT');--> statement-breakpoint
CREATE TYPE "public"."product_request_status" AS ENUM('SUBMITTED', 'IN_RESEARCH', 'QUOTED', 'FULFILLED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."publication_channel" AS ENUM('WEBSITE', 'TELEGRAM');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."purchase_task_status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('ACTIVE', 'EXPIRED', 'CONSUMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."scraper_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."seller_trust_status" AS ENUM('APPROVED', 'PENDING_REVIEW', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."transport_class" AS ENUM('XS', 'S', 'M', 'L', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('PLANNED', 'COLLECTING', 'PACKED', 'DEPARTED', 'ARRIVED', 'DISTRIBUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."trust_tier" AS ENUM('OFFICIAL_BRAND', 'AUTHORIZED_RETAILER', 'TRUSTED_MARKETPLACE', 'UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'SUPPORT', 'OPERATOR', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."variant_status" AS ENUM('ACTIVE', 'INACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country" text,
	"logo_media_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name_fa" text NOT NULL,
	"name_en" text NOT NULL,
	"slug" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"requires_manual_review" boolean DEFAULT false NOT NULL,
	"max_weight_grams" integer,
	"default_transport_class" "transport_class",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_not_self_parent" CHECK ("categories"."parent_id" <> "categories"."id"),
	CONSTRAINT "categories_max_weight_positive" CHECK ("categories"."max_weight_grams" is null or "categories"."max_weight_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"kind" "media_kind" DEFAULT 'GALLERY' NOT NULL,
	"storage_key" text,
	"source_url" text,
	"alt_text_fa" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_attribution" text,
	"rights_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_location_present" CHECK ("product_media"."storage_key" is not null or "product_media"."source_url" is not null)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_internal" text NOT NULL,
	"gtin" text,
	"manufacturer_sku" text,
	"size" text,
	"color" text,
	"volume_ml" integer,
	"gender_use" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight_grams_override" integer,
	"status" "variant_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_gtin_digits" CHECK ("product_variants"."gtin" is null or "product_variants"."gtin" ~ '^[0-9]{8,14}$'),
	CONSTRAINT "product_variants_volume_positive" CHECK ("product_variants"."volume_ml" is null or "product_variants"."volume_ml" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title_fa" text NOT NULL,
	"title_original" text NOT NULL,
	"slug" text NOT NULL,
	"description_fa" text,
	"status" "product_status" DEFAULT 'DRAFT' NOT NULL,
	"weight_grams" integer,
	"dimensions_mm" jsonb,
	"transport_class" "transport_class",
	"product_type" text,
	"canonical_identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_weight_positive" CHECK ("products"."weight_grams" is null or "products"."weight_grams" > 0),
	CONSTRAINT "products_published_has_timestamp" CHECK ("products"."status" <> 'PUBLISHED' or "products"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"source_offer_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_key" text,
	"status" "cart_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_owner_present" CHECK ("carts"."user_id" is not null or "carts"."anonymous_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"source_offer_id" uuid,
	"product_snapshot" jsonb NOT NULL,
	"offer_snapshot" jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"unit_total_toman" bigint NOT NULL,
	"line_total_toman" bigint NOT NULL,
	"max_source_price_eur_cents" bigint,
	"procurement_status" "order_item_procurement_status" DEFAULT 'PENDING' NOT NULL,
	"source_stock_status" "stock_status" DEFAULT 'UNKNOWN' NOT NULL,
	"authenticity_status" "authenticity_status" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_line_total_matches" CHECK ("order_items"."line_total_toman" = "order_items"."unit_total_toman" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_status_history_changes_state" CHECK ("order_status_history"."from_status" is null or "order_status_history"."from_status" <> "order_status_history"."to_status")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid,
	"shipping_address_id" uuid,
	"status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"total_locked_toman" bigint NOT NULL,
	"deposit_required_toman" bigint NOT NULL,
	"deposit_paid_toman" bigint DEFAULT 0 NOT NULL,
	"balance_due_toman" bigint NOT NULL,
	"balance_paid_toman" bigint DEFAULT 0 NOT NULL,
	"display_currency" text DEFAULT 'TOMAN' NOT NULL,
	"expected_delivery_start" timestamp with time zone,
	"expected_delivery_end" timestamp with time zone,
	"trip_id" uuid,
	"placed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_non_negative" CHECK ("orders"."total_locked_toman" >= 0
        and "orders"."deposit_required_toman" >= 0
        and "orders"."deposit_paid_toman" >= 0
        and "orders"."balance_due_toman" >= 0
        and "orders"."balance_paid_toman" >= 0),
	CONSTRAINT "orders_split_balances" CHECK ("orders"."deposit_required_toman" + "orders"."balance_due_toman" = "orders"."total_locked_toman"),
	CONSTRAINT "orders_paid_within_total" CHECK ("orders"."deposit_paid_toman" + "orders"."balance_paid_toman" <= "orders"."total_locked_toman"),
	CONSTRAINT "orders_delivery_window_order" CHECK ("orders"."expected_delivery_start" is null
        or "orders"."expected_delivery_end" is null
        or "orders"."expected_delivery_end" >= "orders"."expected_delivery_start")
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipts_size_positive" CHECK ("payment_receipts"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" "payment_type" NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" text NOT NULL,
	"amount_toman" bigint NOT NULL,
	"provider_authority" text,
	"provider_reference" text,
	"idempotency_key" text NOT NULL,
	"status" "payment_status" DEFAULT 'INITIATED' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_toman" > 0),
	CONSTRAINT "payments_verified_when_succeeded" CHECK ("payments"."status" <> 'SUCCEEDED' or "payments"."verified_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"author_user_id" uuid,
	"is_staff_answer" boolean DEFAULT false NOT NULL,
	"body_fa" text NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_bps" integer,
	"discount_toman" bigint,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"active_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_discount_present" CHECK (("coupons"."discount_bps" is not null) <> ("coupons"."discount_toman" is not null)),
	CONSTRAINT "coupons_bps_range" CHECK ("coupons"."discount_bps" is null or ("coupons"."discount_bps" > 0 and "coupons"."discount_bps" <= 10000)),
	CONSTRAINT "coupons_redemptions_within_max" CHECK ("coupons"."max_redemptions" is null or "coupons"."redemption_count" <= "coupons"."max_redemptions")
);
--> statement-breakpoint
CREATE TABLE "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_ledger_points_non_zero" CHECK ("loyalty_ledger"."points" <> 0)
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"topic" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'QUEUED' NOT NULL,
	"provider_reference" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"topic" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"threshold_toman" bigint NOT NULL,
	"status" "alert_status" DEFAULT 'ACTIVE' NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_alerts_threshold_positive" CHECK ("price_alerts"."threshold_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_request_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"source_offer_id" uuid,
	"proposed_url" text,
	"estimated_toman" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"contact_phone_e164" text,
	"description_fa" text NOT NULL,
	"reference_url" text,
	"budget_toman" bigint,
	"status" "product_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"handled_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_requests_budget_positive" CHECK ("product_requests"."budget_toman" is null or "product_requests"."budget_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"body_fa" text NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recently_viewed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid,
	"code" text NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_no_self_referral" CHECK ("referrals"."referred_user_id" is null or "referrals"."referred_user_id" <> "referrals"."referrer_user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"body_fa" text,
	"moderation_status" "moderation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" >= 1 and "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "stock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"status" "alert_status" DEFAULT 'ACTIVE' NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"province" text NOT NULL,
	"city" text NOT NULL,
	"address_line" text NOT NULL,
	"postal_code" text,
	"national_id_encrypted" text,
	"plus_code" text,
	"metadata" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "addresses_postal_code_format" CHECK ("addresses"."postal_code" is null or "addresses"."postal_code" ~ '^[0-9]{10}$')
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"phone_e164" text,
	"phone_verified_at" timestamp with time zone,
	"password_hash" text,
	"display_name" text,
	"role" "user_role" DEFAULT 'CUSTOMER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"preferred_locale" text DEFAULT 'fa-IR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_identifier_present" CHECK ("users"."email" is not null or "users"."phone_e164" is not null),
	CONSTRAINT "users_phone_e164_format" CHECK ("users"."phone_e164" is null or "users"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"departure_window_start" timestamp with time zone,
	"departure_window_end" timestamp with time zone,
	"arrival_window_start" timestamp with time zone,
	"arrival_window_end" timestamp with time zone,
	"capacity_weight_grams" integer,
	"status" "trip_status" DEFAULT 'PLANNED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_capacity_positive" CHECK ("trips"."capacity_weight_grams" is null or "trips"."capacity_weight_grams" > 0),
	CONSTRAINT "trips_departure_window_order" CHECK ("trips"."departure_window_start" is null
        or "trips"."departure_window_end" is null
        or "trips"."departure_window_end" >= "trips"."departure_window_start"),
	CONSTRAINT "trips_arrival_window_order" CHECK ("trips"."arrival_window_start" is null
        or "trips"."arrival_window_end" is null
        or "trips"."arrival_window_end" >= "trips"."arrival_window_start")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"locale" text DEFAULT 'fa-IR' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'DRAFT' NOT NULL,
	"title" text,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_entries_version_positive" CHECK ("content_entries"."version" > 0),
	CONSTRAINT "content_entries_published_has_timestamp" CHECK ("content_entries"."status" <> 'PUBLISHED' or "content_entries"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "jobs_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"job_name" text NOT NULL,
	"external_job_id" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"render_inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"renderer_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_events_attempts_non_negative" CHECK ("outbox_events"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "publication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "publication_channel" NOT NULL,
	"product_id" uuid,
	"content_entry_id" uuid,
	"status" "publication_status" DEFAULT 'QUEUED' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"external_message_id" text,
	"approved_by_user_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_jobs_target_present" CHECK ("publication_jobs"."product_id" is not null or "publication_jobs"."content_entry_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "scraper_run_status" DEFAULT 'RUNNING' NOT NULL,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"extractor_version" text,
	CONSTRAINT "scraper_runs_counts_non_negative" CHECK ("scraper_runs"."discovered_count" >= 0 and "scraper_runs"."updated_count" >= 0 and "scraper_runs"."error_count" >= 0),
	CONSTRAINT "scraper_runs_finish_after_start" CHECK ("scraper_runs"."finished_at" is null or "scraper_runs"."finished_at" >= "scraper_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"base_currency" text DEFAULT 'EUR' NOT NULL,
	"quote_currency" text DEFAULT 'TOMAN' NOT NULL,
	"side" text DEFAULT 'SELL' NOT NULL,
	"toman_per_unit" bigint NOT NULL,
	"provider_timestamp" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_reference" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "fx_rates_positive" CHECK ("fx_rates"."toman_per_unit" > 0),
	CONSTRAINT "fx_rates_side_valid" CHECK ("fx_rates"."side" in ('BUY', 'SELL'))
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "pricing_rule_scope" NOT NULL,
	"category_id" uuid,
	"brand_id" uuid,
	"product_id" uuid,
	"trust_tier" "trust_tier",
	"price_band_min_eur_cents" bigint,
	"price_band_max_eur_cents" bigint,
	"priority" integer DEFAULT 0 NOT NULL,
	"target_margin_bps" integer NOT NULL,
	"min_profit_toman" bigint NOT NULL,
	"transport_class" "transport_class" NOT NULL,
	"customs_risk_bps" integer DEFAULT 0 NOT NULL,
	"fx_buffer_bps" integer DEFAULT 0 NOT NULL,
	"payment_fee_bps" integer DEFAULT 0 NOT NULL,
	"deposit_bps" integer NOT NULL,
	"min_deposit_toman" bigint DEFAULT 0 NOT NULL,
	"rounding_unit_toman" bigint DEFAULT 10000 NOT NULL,
	"active_from" timestamp with time zone DEFAULT now() NOT NULL,
	"active_to" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_rules_margin_range" CHECK ("pricing_rules"."target_margin_bps" >= 0 and "pricing_rules"."target_margin_bps" < 10000),
	CONSTRAINT "pricing_rules_deposit_range" CHECK ("pricing_rules"."deposit_bps" > 0 and "pricing_rules"."deposit_bps" <= 10000),
	CONSTRAINT "pricing_rules_fee_range" CHECK ("pricing_rules"."payment_fee_bps" >= 0 and "pricing_rules"."payment_fee_bps" < 10000),
	CONSTRAINT "pricing_rules_margin_plus_fee" CHECK ("pricing_rules"."target_margin_bps" + "pricing_rules"."payment_fee_bps" < 10000),
	CONSTRAINT "pricing_rules_rounding_positive" CHECK ("pricing_rules"."rounding_unit_toman" > 0),
	CONSTRAINT "pricing_rules_active_window" CHECK ("pricing_rules"."active_to" is null or "pricing_rules"."active_to" > "pricing_rules"."active_from"),
	CONSTRAINT "pricing_rules_price_band_order" CHECK ("pricing_rules"."price_band_min_eur_cents" is null or "pricing_rules"."price_band_max_eur_cents" is null or "pricing_rules"."price_band_max_eur_cents" > "pricing_rules"."price_band_min_eur_cents"),
	CONSTRAINT "pricing_rules_scope_target" CHECK (("pricing_rules"."scope" <> 'CATEGORY' or "pricing_rules"."category_id" is not null)
        and ("pricing_rules"."scope" <> 'BRAND' or "pricing_rules"."brand_id" is not null)
        and ("pricing_rules"."scope" <> 'PRODUCT' or "pricing_rules"."product_id" is not null)
        and ("pricing_rules"."scope" <> 'TRUST_TIER' or "pricing_rules"."trust_tier" is not null)
        and ("pricing_rules"."scope" <> 'PRICE_BAND' or "pricing_rules"."price_band_min_eur_cents" is not null or "pricing_rules"."price_band_max_eur_cents" is not null))
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"source_offer_id" uuid,
	"product_variant_id" uuid,
	"quantity" integer NOT NULL,
	"source_price_eur_cents" bigint NOT NULL,
	"shipping_eur_cents" bigint DEFAULT 0 NOT NULL,
	"source_toman_total" bigint NOT NULL,
	"transport_toman" bigint DEFAULT 0 NOT NULL,
	"customs_risk_toman" bigint DEFAULT 0 NOT NULL,
	"local_delivery_toman" bigint DEFAULT 0 NOT NULL,
	"payment_fee_toman" bigint DEFAULT 0 NOT NULL,
	"margin_toman" bigint DEFAULT 0 NOT NULL,
	"line_total_toman" bigint NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_quantity_positive" CHECK ("quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_line_total_positive" CHECK ("quote_items"."line_total_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"cart_id" uuid,
	"fx_rate_id" uuid NOT NULL,
	"fx_toman_per_eur" bigint NOT NULL,
	"subtotal_toman" bigint NOT NULL,
	"final_toman" bigint NOT NULL,
	"deposit_toman" bigint NOT NULL,
	"balance_toman" bigint NOT NULL,
	"applied_rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculation_version" text NOT NULL,
	"status" "quote_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_amounts_non_negative" CHECK ("quotes"."subtotal_toman" >= 0
      and "quotes"."final_toman" >= 0
      and "quotes"."deposit_toman" >= 0
      and "quotes"."balance_toman" >= 0),
	CONSTRAINT "quotes_deposit_within_total" CHECK ("quotes"."deposit_toman" <= "quotes"."final_toman"),
	CONSTRAINT "quotes_split_balances" CHECK ("quotes"."deposit_toman" + "quotes"."balance_toman" = "quotes"."final_toman")
);
--> statement-breakpoint
CREATE TABLE "local_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"address_id" uuid,
	"courier" text,
	"tracking_code" text,
	"status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_deliveries_delivered_timestamp" CHECK ("local_deliveries"."status" <> 'DELIVERED' or "local_deliveries"."delivered_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "purchase_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_documents_size_positive" CHECK ("purchase_documents"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"source_url" text NOT NULL,
	"target_max_price_eur_cents" bigint NOT NULL,
	"due_at" timestamp with time zone,
	"status" "purchase_task_status" DEFAULT 'OPEN' NOT NULL,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_tasks_target_price_positive" CHECK ("purchase_tasks"."target_max_price_eur_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"purchase_task_id" uuid,
	"buyer_user_id" uuid,
	"retailer_id" uuid NOT NULL,
	"seller_id" uuid,
	"purchase_eur_cents" bigint NOT NULL,
	"shipping_eur_cents" bigint DEFAULT 0 NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retailer_order_ref" text,
	"retailer_order_ref_masked" text,
	"evidence_status" "evidence_status" DEFAULT 'MISSING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_amount_positive" CHECK ("purchases"."purchase_eur_cents" > 0),
	CONSTRAINT "purchases_shipping_non_negative" CHECK ("purchases"."shipping_eur_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trip_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"packed_weight_grams" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_items_weight_positive" CHECK ("trip_items"."packed_weight_grams" is null or "trip_items"."packed_weight_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "offer_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"price_eur_cents" bigint NOT NULL,
	"shipping_eur_cents" bigint,
	"stock_status" "stock_status" NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_price_history_price_positive" CHECK ("offer_price_history"."price_eur_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "raw_source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"http_status" integer,
	"content_hash" text NOT NULL,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extractor_version" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "retailer_sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"external_seller_id" text NOT NULL,
	"seller_name" text,
	"trust_status" "seller_trust_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"review_notes" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"country" text DEFAULT 'DE' NOT NULL,
	"trust_tier" "trust_tier" DEFAULT 'UNVERIFIED' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"crawl_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_interval_minutes" integer DEFAULT 180 NOT NULL,
	"terms_notes" text,
	"last_health_status" text,
	"last_health_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retailers_interval_positive" CHECK ("retailers"."default_interval_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "source_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"seller_id" uuid,
	"external_offer_id" text,
	"source_url" text NOT NULL,
	"product_variant_id" uuid,
	"raw_title" text NOT NULL,
	"source_price_eur_cents" bigint NOT NULL,
	"previous_price_eur_cents" bigint,
	"shipping_eur_cents" bigint,
	"discount_bps" integer,
	"stock_status" "stock_status" DEFAULT 'UNKNOWN' NOT NULL,
	"stock_quantity" integer,
	"source_identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_verified" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"raw_snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_offers_price_positive" CHECK ("source_offers"."source_price_eur_cents" > 0),
	CONSTRAINT "source_offers_shipping_non_negative" CHECK ("source_offers"."shipping_eur_cents" is null or "source_offers"."shipping_eur_cents" >= 0),
	CONSTRAINT "source_offers_discount_range" CHECK ("source_offers"."discount_bps" is null or ("source_offers"."discount_bps" >= 0 and "source_offers"."discount_bps" <= 10000)),
	CONSTRAINT "source_offers_stock_quantity_non_negative" CHECK ("source_offers"."stock_quantity" is null or "source_offers"."stock_quantity" >= 0),
	CONSTRAINT "source_offers_seen_order" CHECK ("source_offers"."last_seen_at" >= "source_offers"."first_seen_at")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_source_offer_id_source_offers_id_fk" FOREIGN KEY ("source_offer_id") REFERENCES "public"."source_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_source_offer_id_source_offers_id_fk" FOREIGN KEY ("source_offer_id") REFERENCES "public"."source_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_addresses_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request_candidates" ADD CONSTRAINT "product_request_candidates_request_id_product_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."product_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request_candidates" ADD CONSTRAINT "product_request_candidates_source_offer_id_source_offers_id_fk" FOREIGN KEY ("source_offer_id") REFERENCES "public"."source_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_handled_by_user_id_users_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_jobs" ADD CONSTRAINT "publication_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_jobs" ADD CONSTRAINT "publication_jobs_content_entry_id_content_entries_id_fk" FOREIGN KEY ("content_entry_id") REFERENCES "public"."content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_jobs" ADD CONSTRAINT "publication_jobs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_runs" ADD CONSTRAINT "scraper_runs_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_source_offer_id_source_offers_id_fk" FOREIGN KEY ("source_offer_id") REFERENCES "public"."source_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_fx_rate_id_fx_rates_id_fk" FOREIGN KEY ("fx_rate_id") REFERENCES "public"."fx_rates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_deliveries" ADD CONSTRAINT "local_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_deliveries" ADD CONSTRAINT "local_deliveries_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_tasks" ADD CONSTRAINT "purchase_tasks_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_tasks" ADD CONSTRAINT "purchase_tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_purchase_task_id_purchase_tasks_id_fk" FOREIGN KEY ("purchase_task_id") REFERENCES "public"."purchase_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_seller_id_retailer_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."retailer_sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_price_history" ADD CONSTRAINT "offer_price_history_offer_id_source_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."source_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_source_snapshots" ADD CONSTRAINT "raw_source_snapshots_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_sellers" ADD CONSTRAINT "retailer_sellers_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_offers" ADD CONSTRAINT "source_offers_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_offers" ADD CONSTRAINT "source_offers_seller_id_retailer_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."retailer_sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_offers" ADD CONSTRAINT "source_offers_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_unique" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_active_idx" ON "brands" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_media_variant_idx" ON "product_media" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants" USING btree ("sku_internal");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_gtin_unique" ON "product_variants" USING btree ("gtin") WHERE "product_variants"."gtin" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_brand_category_idx" ON "products" USING btree ("brand_id","category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_variant_unique" ON "cart_items" USING btree ("cart_id","product_variant_id");--> statement-breakpoint
CREATE INDEX "carts_user_idx" ON "carts" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_anonymous_key_unique" ON "carts" USING btree ("anonymous_key") WHERE "carts"."anonymous_key" is not null;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_procurement_idx" ON "order_items" USING btree ("procurement_status");--> statement-breakpoint
CREATE INDEX "order_status_history_order_time_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_trip_idx" ON "orders" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "payment_receipts_payment_idx" ON "payment_receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_reference_unique" ON "payments" USING btree ("provider","provider_reference") WHERE "payments"."provider_reference" is not null;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "answers_question_idx" ON "answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "loyalty_ledger_user_time_idx" ON "loyalty_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_user_time_idx" ON "notification_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_unique" ON "notification_preferences" USING btree ("user_id","channel","topic");--> statement-breakpoint
CREATE UNIQUE INDEX "price_alerts_active_unique" ON "price_alerts" USING btree ("user_id","product_id") WHERE "price_alerts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "price_alerts_threshold_idx" ON "price_alerts" USING btree ("product_id","threshold_toman") WHERE "price_alerts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "product_request_candidates_request_idx" ON "product_request_candidates" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "product_requests_status_idx" ON "product_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "questions_product_status_idx" ON "questions" USING btree ("product_id","moderation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "recently_viewed_user_product_unique" ON "recently_viewed" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "recently_viewed_user_time_idx" ON "recently_viewed" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_code_unique" ON "referrals" USING btree ("code");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_product_unique" ON "reviews" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_product_status_idx" ON "reviews" USING btree ("product_id","moderation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_alerts_active_unique" ON "stock_alerts" USING btree ("user_id","product_variant_id") WHERE "stock_alerts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "stock_alerts_variant_idx" ON "stock_alerts" USING btree ("product_variant_id") WHERE "stock_alerts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "wishlists_user_product_unique" ON "wishlists" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_single_default" ON "addresses" USING btree ("user_id") WHERE "addresses"."is_default" and "addresses"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_unique" ON "auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email")) WHERE "users"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone_e164") WHERE "users"."phone_e164" is not null;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_hash_unique" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "verification_tokens_identifier_idx" ON "verification_tokens" USING btree ("identifier","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_code_unique" ON "trips" USING btree ("code");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status","departure_window_start");--> statement-breakpoint
CREATE INDEX "admin_audit_log_entity_idx" ON "admin_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_time_idx" ON "admin_audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_entries_key_locale_version_unique" ON "content_entries" USING btree ("key","locale","version");--> statement-breakpoint
CREATE INDEX "content_entries_status_idx" ON "content_entries" USING btree ("status","locale");--> statement-breakpoint
CREATE INDEX "jobs_audit_queue_time_idx" ON "jobs_audit" USING btree ("queue","created_at");--> statement-breakpoint
CREATE INDEX "marketing_assets_product_idx" ON "marketing_assets" USING btree ("product_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_assets_storage_key_unique" ON "marketing_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("available_at") WHERE "outbox_events"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "publication_jobs_status_idx" ON "publication_jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_jobs_external_message_unique" ON "publication_jobs" USING btree ("channel","external_message_id") WHERE "publication_jobs"."external_message_id" is not null;--> statement-breakpoint
CREATE INDEX "scraper_runs_retailer_time_idx" ON "scraper_runs" USING btree ("retailer_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_key_unique" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "fx_rates_lookup_idx" ON "fx_rates" USING btree ("base_currency","quote_currency","side","provider_timestamp");--> statement-breakpoint
CREATE INDEX "pricing_rules_resolution_idx" ON "pricing_rules" USING btree ("scope","priority","active_from");--> statement-breakpoint
CREATE INDEX "pricing_rules_category_idx" ON "pricing_rules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_brand_idx" ON "pricing_rules" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_user_created_idx" ON "quotes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quotes_status_expiry_idx" ON "quotes" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "local_deliveries_order_idx" ON "local_deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "local_deliveries_status_idx" ON "local_deliveries" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "purchase_documents_purchase_idx" ON "purchase_documents" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_tasks_status_due_idx" ON "purchase_tasks" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "purchase_tasks_assignee_idx" ON "purchase_tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_tasks_open_per_item" ON "purchase_tasks" USING btree ("order_item_id") WHERE "purchase_tasks"."status" not in ('COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE INDEX "purchases_order_item_idx" ON "purchases" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "purchases_retailer_time_idx" ON "purchases" USING btree ("retailer_id","purchased_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_items_order_item_unique" ON "trip_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "trip_items_trip_idx" ON "trip_items" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "offer_price_history_offer_time_idx" ON "offer_price_history" USING btree ("offer_id","observed_at");--> statement-breakpoint
CREATE INDEX "raw_source_snapshots_retailer_time_idx" ON "raw_source_snapshots" USING btree ("retailer_id","captured_at");--> statement-breakpoint
CREATE INDEX "raw_source_snapshots_hash_idx" ON "raw_source_snapshots" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_sellers_external_unique" ON "retailer_sellers" USING btree ("retailer_id","external_seller_id");--> statement-breakpoint
CREATE INDEX "retailer_sellers_trust_idx" ON "retailer_sellers" USING btree ("trust_status");--> statement-breakpoint
CREATE UNIQUE INDEX "retailers_domain_unique" ON "retailers" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "retailers_enabled_idx" ON "retailers" USING btree ("is_enabled","trust_tier");--> statement-breakpoint
CREATE UNIQUE INDEX "source_offers_external_unique" ON "source_offers" USING btree ("retailer_id","external_offer_id") WHERE "source_offers"."external_offer_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "source_offers_url_unique" ON "source_offers" USING btree ("retailer_id","source_url");--> statement-breakpoint
CREATE INDEX "source_offers_variant_idx" ON "source_offers" USING btree ("product_variant_id","stock_status");--> statement-breakpoint
CREATE INDEX "source_offers_price_idx" ON "source_offers" USING btree ("stock_status","source_price_eur_cents");--> statement-breakpoint
CREATE INDEX "source_offers_last_seen_idx" ON "source_offers" USING btree ("last_seen_at");