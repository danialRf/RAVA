# Phase 6 — Admin Operating System

Build the admin from `ADMIN_SPEC.md`.

Implement role-aware:
- overview,
- catalog,
- orders,
- payments,
- pricing,
- product requests,
- customers,
- trips,
- procurement,
- retailers,
- scraper placeholder/health screens,
- content,
- publications placeholder,
- audit log.

Use queues/status-first UX.

## Pricing settings (required)

The admin pricing screen must let an authorized admin edit, at any time, every
`pricing_rules` factor **except the live EUR→Toman FX rate**, which always
comes from the configured FX provider (`packages/integrations/src/fx.ts`) and
is never hand-typed as a substitute for it:

- target margin (bps),
- minimum absolute profit (Toman),
- payment gateway fee (bps),
- deposit percentage and minimum deposit (Toman),
- FX safety buffer (bps),
- customs/risk reserve (bps),
- transport tariffs per class (XS/S/M/L: flat Toman + per-gram Toman),
- rounding unit (Toman),
- rule scope/priority (global, category, brand, price band, trust tier, product override) and its active-from/active-to window.

Requirements:
- Edits write to `pricing_rules` (and a transport-tariff table/config if tariffs
  move out of `packages/domain/src/pricing.ts`'s hardcoded `TRANSPORT_TARIFFS`
  into the database) — never to environment variables or code.
- A saved change must be readable back through
  `packages/db/src/repositories/pricing.ts::resolvePricingRule` and immediately
  affect `estimatePrice()` output on the next storefront request — no redeploy.
- Manual admin FX entry (the `manual` `FxRateProvider`) is a separate, clearly
  labeled fallback for when the live provider is unavailable — do not conflate
  it with the pricing-factor settings above.
- Validate inputs against the same invariants the database check constraints
  already enforce (margin + fee < 100%, deposit bps in (0, 10000], positive
  rounding unit, etc.) and show the resulting recommended price live as the
  admin edits, per docs/PRICING_ENGINE.md §13 (admin pricing simulator).
- Every change is audit-logged (`admin_audit_log`): actor, before/after values,
  timestamp.

Add:
- saved filters where useful,
- bulk actions with guards,
- mobile buyer procurement view,
- audit logging on sensitive actions.

No fake analytics presented as real business data; seed/demo mode must be labeled.

E2E RBAC and core admin flows.

Update PROJECT_STATE.
