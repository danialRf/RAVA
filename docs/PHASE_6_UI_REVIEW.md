# Phase 6 admin UI review

Date: 2026-08-26

## Verified operating surface

- Overview, orders, procurement, payments and audit remain separated from the storefront layout.
- Catalog, offers, pricing, trips, customers, requests, sources, content and health are first-class navigation destinations, filtered by RBAC.
- Every list has an honest empty state; mutable modules show validation feedback and disable controls for read-only specialist roles.
- Tables become stacked operational records at narrow widths; forms collapse to one column and retain semantic labels.
- An authenticated `OWNER` E2E journey opened every Phase 6 module at 390 × 844 and asserted that no page overflowed horizontally.
- Mobile capture: `phase-6-admin-trips-390x844.png`.

## Safety review

- Source verification fails closed for unmatched offers.
- Live FX is visible in health/pricing context but is not manually editable.
- Monetary inputs are parsed as integer Toman, EUR cents or basis points.
- Content starts as draft and publication is explicit.
- Sensitive receipts remain behind authenticated, no-store routes.
- All write actions are server-authorized and append an audit entry inside the same database transaction.

## Deferred to Phase 7

- Customer choice after reconfirmation.
- Balance payment and reconciliation.
- Departure/arrival propagation, local delivery and returns.
- Production provider wiring and rights-cleared catalog photography.
