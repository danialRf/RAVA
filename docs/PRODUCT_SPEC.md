# Product Specification — RAVA

## 1. Product vision

RAVA gives Iranian customers a trustworthy way to order authentic, relatively lightweight products sourced from Germany without paying the full amount months before delivery.

The experience combines:
- curated German offers,
- transparent source/provenance,
- approximate live-Toman prices,
- short-lived checkout quotes,
- partial deposit payment,
- long-lead-time order tracking,
- periodic Germany → Iran trip fulfillment.

## 2. Launch proposition

Primary message:
**اصل، آن‌طور که باید باشد.**

Support promise:
- source is shown,
- pricing logic is transparent,
- purchase evidence can be retained,
- customer sees where the order is in the journey,
- final Toman total is locked after quote/payment/procurement policy is satisfied.

## 3. Audience

Primary:
Iranian shoppers who care about authentic branded products and are willing to wait for a better sourcing/value proposition.

Do not assume all are ultra-wealthy. The design should feel aspirational but accessible.

## 4. Categories

The domain model must support broad categories.

Launch-enabled examples:
- perfume/fragrance,
- makeup,
- skincare,
- haircare,
- sneakers,
- shoes,
- clothing,
- bags,
- accessories,
- watches,
- home/lifestyle small goods.

Electronics are excluded.

Heavy/bulky items are not normally eligible.

Regulated categories (e.g. supplements, medicinal/medical products, some cosmetics depending on rules) must be feature-flagged **off** until compliance requirements are reviewed.

Each category must support:
- `is_enabled`,
- `requires_manual_review`,
- `max_weight_grams`,
- `max_volume_class`,
- pricing rule,
- deposit rule,
- shipping/risk rule.

## 5. Order model

Typical customer flow:

1. Customer sees estimated Toman price.
2. Customer adds product/variant.
3. Checkout requests a fresh quote.
4. Quote is valid for a short period (default 10 minutes).
5. Customer pays deposit (default target 35%; configurable 33–50%+ by risk).
6. Order becomes `PROCUREMENT_PENDING`.
7. RAVA buyer purchases product in Germany.
8. Purchase evidence is attached.
9. Total order price becomes locked according to quote/procurement policy.
10. Item is received by buyer in Germany.
11. Item is assigned to a Germany → Iran trip.
12. Customer sees tracking milestones.
13. Item arrives in Iran.
14. Remaining balance becomes due.
15. Customer pays balance.
16. Local delivery.
17. Order delivered.

## 6. Price changes before procurement

A deposit does not magically guarantee a foreign retailer's stock/price.

If before RAVA confirms procurement:
- item goes out of stock, or
- source price changes beyond configured tolerance, or
- source becomes untrusted,

the order must enter `CUSTOMER_RECONFIRMATION_REQUIRED` or `REFUND_REQUIRED`.

Never silently charge a different total.

## 7. Delivery expectations

Lead time is usually 2–6 months.

Never display false precision.

Use:
- expected window,
- current trip/drop,
- milestone history,
- latest human-readable status.

Example:
“تحویل تقریبی: آبان تا دی”
rather than a fake exact date when no exact date exists.

## 8. “Find it for me” request

Customers can submit:
- product name,
- URL,
- screenshot/image,
- brand,
- model,
- category,
- size,
- color,
- maximum budget,
- notes.

Admin workflow:
`NEW → RESEARCHING → OPTIONS_FOUND → QUOTED → ACCEPTED → ORDER_CREATED → CLOSED`

Later, approved retailer adapters may search candidates automatically.

## 9. Price alerts

Customers can create:
- product price threshold,
- source-price threshold in EUR,
- stock alert,
- size/variant availability alert.

Alerts should be event-driven from offer history, not by running one crawler per user.

## 10. Customer account

Account dashboard eventually contains:
- orders,
- balances due,
- milestones,
- wishlist,
- saved sizes,
- favorite brands,
- price alerts,
- product requests,
- addresses,
- support,
- source/proof documents safe for customer viewing,
- notification settings.

## 11. Authenticity/source states

At offer level:
- `UNVERIFIED_SOURCE`
- `SOURCE_REVIEW_REQUIRED`
- `SOURCE_VERIFIED`

At procured order-item level:
- `PURCHASE_EVIDENCE_PENDING`
- `PURCHASE_EVIDENCE_ATTACHED`
- `RAVA_AUTHENTICITY_GUARANTEE_ELIGIBLE`
- `RAVA_AUTHENTICITY_GUARANTEE_ACTIVE`

Do not conflate source verification with physical forensic authentication.

## 12. Inventory types

Support:
- `PREORDER_FROM_SOURCE`
- `IN_GERMANY`
- `IN_TRANSIT`
- `IN_IRAN`
- `READY_STOCK_IRAN`

Ready-stock products can support ordinary full-payment checkout.

## 13. Roles

Customer:
- browse/order/manage account.

Internal:
- OWNER
- ADMIN
- MERCHANDISER
- BUYER_GERMANY
- SUPPORT
- FINANCE
- CONTENT_EDITOR

Permissions must be explicit.

## 14. Launch scope vs future scope

Architect for the full model; release incrementally.

V1 should not wait for:
- AI,
- recommendations,
- loyalty,
- fully automatic publishing,
- many scrapers,
- perfect bilingual support.

The first usable launch can work with manual product entry and deterministic pricing/content while later phases automate.
