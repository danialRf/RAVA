CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"bucket" text NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_rate_limits_attempt_positive" CHECK ("auth_rate_limits"."attempt_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "private_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"purpose" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_uploads_size_positive" CHECK ("private_uploads"."size_bytes" > 0),
	CONSTRAINT "private_uploads_content_type_allowed" CHECK ("private_uploads"."content_type" in ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
ALTER TABLE "product_requests" ADD COLUMN "image_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "private_uploads" ADD CONSTRAINT "private_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_rate_limits_bucket_unique" ON "auth_rate_limits" USING btree ("action","identifier_hash","bucket");--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "private_uploads_user_idx" ON "private_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "private_uploads_purpose_idx" ON "private_uploads" USING btree ("purpose");--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_image_upload_id_private_uploads_id_fk" FOREIGN KEY ("image_upload_id") REFERENCES "public"."private_uploads"("id") ON DELETE set null ON UPDATE no action;