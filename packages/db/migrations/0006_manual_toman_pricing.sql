-- Manual Toman pricing.
--
-- Lets an operator price a product directly in Toman instead of deriving the
-- price from a German source offer. Every change here is additive or a
-- relaxation: no existing column is dropped, no existing row is rewritten and
-- every already-locked order total keeps exactly the value it was locked with.

ALTER TABLE "product_variants" ADD COLUMN "manual_price_toman" bigint;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "manual_stock_status" "stock_status";--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_manual_price_positive" CHECK ("product_variants"."manual_price_toman" is null or "product_variants"."manual_price_toman" > 0);--> statement-breakpoint
CREATE INDEX "product_variants_manual_price_idx" ON "product_variants" USING btree ("product_id","manual_price_toman") WHERE "product_variants"."manual_price_toman" is not null;--> statement-breakpoint

-- A fully manual quote has no EUR leg, so it has no FX snapshot to point at.
ALTER TABLE "quotes" ALTER COLUMN "fx_rate_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "fx_toman_per_eur" DROP NOT NULL;--> statement-breakpoint

-- A manually priced order line has no supplier offer to snapshot. Unknown
-- stays unknown rather than being filled with invented retailer data.
ALTER TABLE "order_items" ALTER COLUMN "offer_snapshot" DROP NOT NULL;
