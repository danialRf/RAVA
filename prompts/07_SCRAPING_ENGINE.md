# Phase 7 — Scraping/Ingestion Engine + First Adapter

Implement `SCRAPER_SPEC.md`.

First build:
- retailer adapter contract,
- raw/normalized offer schemas,
- crawl run tracking,
- scheduling in BullMQ,
- HTTP-first fetch utilities,
- Playwright fallback infrastructure,
- rate limits/timeouts/retries,
- anomaly guards,
- raw fixture support,
- normalization/matching pipeline,
- source trust policy,
- deal inbox integration.

For the first real adapter:
- inspect a suitable public German retailer selected from the approved candidate list,
- check whether API/feed/public-page extraction is appropriate,
- do not bypass protections,
- if unsuitable, choose another candidate or implement a fixture/demo adapter and document the blocker.

Scraper never auto-publishes.

Tests must use saved fixtures, not live network.

Update PROJECT_STATE with exact source/adaptor status.
