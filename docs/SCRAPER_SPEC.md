# Retailer / Deal Ingestion Specification

## 1. Goal

Discover legitimate public offers from Germany, normalize them into source offers, preserve provenance, score them, and route them to human approval.

## 2. Ethical/technical boundary

RAVA does not build bypass tooling.

Allowed architecture:
- official API/feed/affiliate feed where available,
- public product/category page extraction,
- normal HTTP,
- browser rendering when required.

Not allowed:
- CAPTCHA bypass,
- authentication bypass,
- stealth fingerprint manipulation,
- scraping private accounts,
- circumventing blocks through rotating identities,
- evading explicit access restrictions.

If a retailer cannot be reliably and appropriately automated, mark it manual.

## 3. Initial source candidates

Prioritize:
- direct brand stores,
- established German retailers,
- established beauty/fashion retailers.

Candidate list for investigation:
- Douglas
- Flaconi
- Zalando
- ABOUT YOU
- Breuninger
- Müller
- dm
- Rossmann
- direct Nike/adidas/Puma brand stores

Marketplace-heavy sources such as Amazon should start in manual/review-required mode because seller provenance varies.

Do not assume every retailer is an authorized seller for every brand. Trust is evaluated per retailer/seller/category.

## 4. Trust tiers

### Tier A
Direct brand / manufacturer store.

### Tier B
Established retailer that RAVA has approved for the category.

### Tier C
Marketplace/third-party seller with manually approved seller provenance.

### Tier D
Unknown/unreviewed. Never auto-publish.

Only A/B can eventually qualify for high-confidence automation.

## 5. Adapter contract

```ts
interface RetailerAdapter {
  id: string;
  discover(input: DiscoverInput): AsyncIterable<RawOffer>;
  fetchOffer(urlOrId: string): Promise<RawOffer>;
  normalize(raw: RawOffer): Promise<NormalizedOffer>;
  healthCheck(): Promise<AdapterHealth>;
}
```

Adapter owns source-specific extraction only.

It must not contain pricing/business decisions.

## 6. HTTP first

Use lightweight HTML/API extraction first.

Use Playwright only when:
- content truly requires JS,
- reliable source data cannot be retrieved otherwise.

Browser crawling is more expensive.

## 7. Scheduling

Configurable per source:
- 2–6 hour intervals typical,
- default 4 hours,
- jitter start times,
- adaptive slowdown when no changes or errors rise.

Do not crawl every product individually if category/feed deltas can reduce load.

## 8. Data captured

At minimum:
- source URL,
- retailer,
- seller when marketplace,
- source product ID,
- title,
- brand if available,
- identifiers such as EAN/SKU,
- variant,
- price,
- reference price if genuine,
- stock,
- source image URLs,
- timestamp.

Optional:
- shipping,
- category,
- attributes.

## 9. Product matching

Priority:
1. GTIN/EAN/UPC exact,
2. manufacturer SKU exact,
3. brand + model + variant deterministic,
4. fuzzy candidate matching,
5. human review.

Never auto-merge low-confidence products.

## 10. Discount validation

A discount requires a trustworthy comparison value.

Do not calculate `50% OFF` from a suspicious inflated “was” price.

Store source's stated reference price and provenance.

## 11. Deal score

Explainable components:
- discount quality,
- projected RAVA margin,
- source trust,
- stock,
- brand/customer interest,
- category transport suitability,
- duplicate/current-catalog status,
- delivery feasibility.

AI is not required.

## 12. Failure behavior

If selector/parser confidence falls:
- adapter run fails,
- no destructive mass update,
- do not mark all offers out-of-stock based on a broken parser.

Use run-level anomaly guards:
- extracted item count collapse,
- missing price ratio,
- DOM/schema signature change.

## 13. Fixtures

Every retailer adapter must have saved sanitized fixtures for parser tests.

Tests should not depend on live retailer sites.

## 14. Raw data retention

Keep enough source metadata to debug:
- fetch timestamp,
- key fields,
- optional small sanitized response fixture/hash.

Avoid unnecessary indefinite storage of full copyrighted pages.

## 15. Admin controls

- pause source,
- run now,
- set interval,
- trust tier,
- approve seller,
- view extraction health,
- blacklist URL/product/seller,
- adapter version.

## 16. Publishing

Scraper never publishes directly.

Pipeline:
`discover → normalize → match → score → content draft → approval policy → publish`

At launch:
human approval required.
