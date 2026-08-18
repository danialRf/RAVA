# Database Specification

Use PostgreSQL. Use explicit enums/check constraints where they protect domain integrity. Monetary values are integers/bigints.

This is a domain map; exact columns may evolve through migrations.

## Identity

### users
- id
- email nullable
- email_verified_at
- phone_e164 nullable
- phone_verified_at
- password_hash nullable
- display_name
- role/customer status
- preferred_locale
- created_at
- updated_at
- deleted_at nullable

### auth_accounts / sessions / verification_tokens
Compatible with chosen auth library/provider model.

### addresses
Iranian customer delivery addresses.

## Catalog

### brands
- id
- name
- slug
- country nullable
- logo media nullable
- is_active

### categories
hierarchical:
- parent_id
- name_fa
- name_en
- slug
- is_enabled
- requires_manual_review
- max_weight_grams
- sort_order

### products
Canonical product:
- id
- brand_id
- category_id
- title_fa
- title_en/original
- slug
- description_fa
- status
- weight_grams nullable
- dimensions nullable
- product_type metadata
- canonical identifiers JSONB
- publish status
- SEO fields
- created_at/updated_at

### product_variants
- product_id
- sku_internal
- gtin/ean/upc nullable
- manufacturer_sku nullable
- size
- color
- volume
- gender/use metadata
- attributes JSONB
- weight override
- status

### product_media
- product/variant
- storage/source URL
- kind
- sort_order
- source attribution
- rights/usage notes nullable

## Retailer/source system

### retailers
- name
- domain
- country
- trust_tier
- is_enabled
- crawl_policy
- default_interval_minutes
- terms_notes
- last_health

### retailer_sellers
Needed for marketplaces:
- retailer_id
- external_seller_id
- seller_name
- trust_status
- review notes

### source_offers
One retailer offer for one variant:
- retailer_id
- seller_id nullable
- external_offer_id
- source_url
- product_variant_id nullable until matched
- raw_title
- source_price_eur_cents
- previous_price_eur_cents nullable
- shipping_eur_cents nullable
- discount_bps nullable
- stock_status
- stock_quantity nullable
- source_identifiers JSONB
- source_image_urls JSONB
- source_verified boolean
- first_seen_at
- last_seen_at
- expires_at nullable
- raw_snapshot_id nullable

Unique on retailer + stable external identifier where available.

### offer_price_history
Append-only:
- offer_id
- price_eur_cents
- shipping_eur_cents
- stock
- observed_at

### raw_source_snapshots
Debug/audit metadata. Avoid storing unnecessary copyrighted full-page content long-term.

## Pricing

### fx_rates
- provider
- base_currency
- quote_currency
- buy/sell
- toman_per_unit
- provider_timestamp
- fetched_at
- raw_reference metadata

### pricing_rules
Scopes:
- global
- category
- brand
- price band
- source trust tier
Fields:
- priority
- target_margin_bps
- min_profit_toman
- transport class
- customs/risk bps
- fx_buffer_bps
- payment_fee_bps
- deposit_bps
- active_from/to

### quotes
Immutable price proposal:
- id
- user/cart
- fx_rate_snapshot
- source offer snapshot
- item lines JSON or normalized child rows
- subtotal/final Toman
- deposit Toman
- balance Toman
- expires_at
- status
- calculation_version

### quote_items
Keep detailed cost breakdown for audit.

## Commerce

### carts / cart_items

### orders
- order_number
- user
- quote_id
- status
- total_locked_toman
- deposit_required_toman
- deposit_paid_toman
- balance_due_toman
- balance_paid_toman
- currency display
- expected_delivery_start/end
- trip_id nullable
- created_at

### order_items
- canonical product/variant snapshot
- source offer snapshot
- unit total Toman
- procurement status
- source status
- authenticity guarantee status

### order_status_history
Append-only customer/admin milestone history.

### payments
- order_id
- type: DEPOSIT/BALANCE/REFUND
- method: GATEWAY/CARD_TO_CARD
- gateway/provider
- amount_toman
- provider_authority/reference
- idempotency_key
- status
- created/verified

### payment_receipts
Private uploads for card-to-card.

## Procurement

### purchase_tasks
- order_item
- assigned_to internal user
- source URL
- target max price
- due
- status

### purchases
- order_item
- buyer
- retailer/seller
- purchase_eur_cents
- purchased_at
- retailer_order_ref masked/public version
- evidence status

### purchase_documents
Private receipt/invoice media.

## Trips/logistics

### trips
- code
- title
- Germany departure window
- Iran arrival window
- capacity/weight targets
- status

### trip_items
order item assignment + packed weight.

### local_deliveries
courier/tracking metadata.

## Engagement

### wishlists
### recently_viewed
### price_alerts
### stock_alerts
### notification_preferences
### notification_deliveries
### product_requests
### product_request_candidates
### reviews
### questions
### answers
### coupons
### referrals
### loyalty_ledger (future)

## Content

### content_entries
homepage/editorial/FAQ content with locale/status/version.

### marketing_assets
generated deterministic product cards and later campaign assets.

### publication_jobs
website/Telegram publication state and external message IDs.

## Automation/admin

### scraper_runs
- retailer
- started/finished
- status
- discovered/updated/error counts
- error summary

### jobs_audit
optional business-visible job records.

### admin_audit_log
- actor
- action
- entity type/id
- before/after safe JSON
- ip/request ID
- timestamp

### feature_flags
for regulated categories and staged features.

## Indexing

Critical indexes:
- product slug
- brand/category
- offer retailer/external ID
- offer current stock/price
- price history offer+time
- order user+created
- order status
- payments provider reference
- alerts active thresholds
- scraper run retailer+time

Use trigram/search indexes where useful for Persian/Latin catalog search.
