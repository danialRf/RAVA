# Phase 11 — Advanced Search, Alerts, Personalization

Improve search.

Start by evaluating whether Postgres search is sufficient.
If advanced typo-tolerant faceting materially improves UX, add self-hosted Typesense behind a search provider abstraction.

Implement:
- Persian/Latin search normalization,
- autocomplete,
- typo tolerance where supported,
- facets,
- saved searches,
- price alerts,
- stock/variant alerts,
- notification jobs,
- popular/trending based on actual events,
- related products using deterministic rules.

Personalized homepage can use simple behavior/rules first.
No paid AI requirement.

Update PROJECT_STATE.
