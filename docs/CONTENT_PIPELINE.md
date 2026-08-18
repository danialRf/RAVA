# Content & Marketing Asset Pipeline

## 1. Launch principle

**Zero AI budget must still produce a complete system.**

Therefore content has two launch engines:

1. deterministic structured copy templates,
2. deterministic branded marketing-card renderer.

AI providers are optional future enrichers.

## 2. Structured product copy

Input facts:
- product,
- variant,
- source,
- EUR price,
- discount,
- estimated/quoted Toman price,
- arrival,
- receipt/source policy.

Template output:
- short storefront summary,
- source statement,
- price explanation,
- Telegram caption.

Never invent product claims.

## 3. Persian caption template

Example structure:

```text
{brand} {model}
{variant_summary}

تهیه از {retailer} آلمان.

قیمت فعلی منبع: {eur_price}
{discount_line_if_verified}
قیمت تقریبی روا: {estimated_toman}

پیش‌پرداخت: {deposit_percent}
تحویل تقریبی: {delivery_window}

{source_evidence_line}

برای دیدن جزئیات و ثبت سفارش:
{product_url}
```

Tone must follow brand system.

## 4. Marketing card generation without AI

Build an HTML/CSS marketing-card template and render with Playwright in the worker.

Recommended formats:
- 1080×1350,
- 1080×1080,
- optional Telegram landscape.

Content:
- real product image,
- RAVA mark,
- product name,
- source,
- EUR/source price,
- estimated RAVA price optionally,
- verified discount,
- arrival/drop badge.

Why HTML/Playwright:
- consistent Persian RTL rendering,
- deterministic,
- no API cost,
- easy to preview in admin.

## 5. Template variants

Create a small controlled system, not random designs:

- `clean-commerce`
- `beauty-editorial`
- `fashion-editorial`
- `deal-source`

All use RAVA tokens.

Admin can preview/select.

## 6. Image integrity

Never:
- alter a bottle/shoe model into a different variant,
- invent packaging,
- display accessories not included,
- hide material defects in actual-stock photos.

The product image remains factual.

## 7. Optional AI later

Interface:

```ts
interface ContentGenerator {
  generateProductCopy(input: VerifiedProductFacts): Promise<GeneratedCopy>;
}
```

Expected structured output:
- `title_fa`
- `short_description_fa`
- `telegram_caption_fa`
- `seo_title_fa`
- `seo_description_fa`
- `claims_used[]`
- `uncertainties[]`
- `needs_review`

The model receives **verified facts only**.

## 8. AI validation

After generation:
- compare numerical facts against input,
- reject changed prices/sizes/discounts,
- reject unsupported authenticity claims,
- reject unsupported ingredient/benefit claims,
- route uncertainty to human review.

## 9. Campaign imagery

Later, generative imagery can be used for editorial campaigns.

Rules:
- not the only image on a product page,
- do not misrepresent the purchased product,
- keep actual product images visible,
- campaign assets need human review.

## 10. Approval levels

Launch:
- content generated/drafted,
- admin approves.

Later:
- source Tier A/B + high confidence + safe category may auto-publish according to policy.
- high-ticket, marketplace, regulated category always human review.
