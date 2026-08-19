CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_title_fa_trgm_idx" ON "products" USING gin ("title_fa" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_title_original_trgm_idx" ON "products" USING gin ("title_original" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_description_fa_trgm_idx" ON "products" USING gin ("description_fa" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brands_name_trgm_idx" ON "brands" USING gin ("name" gin_trgm_ops);
