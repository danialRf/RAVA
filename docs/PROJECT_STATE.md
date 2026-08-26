# Project State

Codex must update this file after every phase.

## Architecture and performance hardening

- Storefront pricing now loads the active pricing-rule set once per server render and resolves product/category/brand/price-band precedence in a pure selector. Product grids no longer issue one pricing-rule query per product.
- The selector has focused tests for specificity, priority/time tie-breaking and half-open price bands. Application-service boundaries, storefront caching/search indexes and CI runtime remain the next hardening milestones.
- CI caches the Playwright browser separately from OS dependencies and performs one production build instead of rebuilding immediately before E2E.
- Account pages read through a dedicated server-side application service instead of receiving database handles. Stable public taxonomy uses a bounded five-minute server cache; product money/stock rows, personalized data, checkout and payment remain uncached because integer money must not pass through a JSON-only cache boundary.
- PostgreSQL trigram indexes cover Persian/original titles, descriptions and brand names so the launch `ILIKE` search path remains usable as the catalog grows.
- Storefront and admin use separate App Router layouts without changing public URLs. Admin requests no longer render storefront navigation/footer or query the next shopping trip; the root layout owns only document-level concerns.
- The admin is a dedicated RTL operations workspace with active navigation, identity and role visibility, store preview/logout controls, actionable queue shortcuts and an honest list of modules that are not built yet.

## Current phase

`PHASE_7_POST_PURCHASE_LIFECYCLE_READY`

## Completed

- Phase 0 repository bootstrap and local infrastructure verification — 2026-08-14.
- Phase 1 reusable Persian-first storefront and design system — 2026-08-14.
- Phase 2 domain model and PostgreSQL implementation — 2026-08-16.
- Phase 3 database-backed catalog storefront — 2026-08-17.
- Phase 4 authentication and customer accounts — 2026-08-18.
- Phase 5 cart, binding quote and deposit payment — 2026-08-18.
- Beauty-editorial storefront art direction and Vazirmatn/B-Vazir typography refinement — 2026-08-18.

- Phase 6 admin foundation, RBAC, audited payment/procurement actions and dedicated operations workspace — 2026-08-26.
- Phase 6 complete admin operating system: catalog, offers, pricing, trips, customers, requests, sources, content, health, procurement evidence and audit — 2026-08-26.

## Delivered foundations

### Domain and data

- `@rava/domain` owns canonical enums, integer EUR-cent/Toman money helpers, pricing rules and transition guards. Persisted money never uses JavaScript floating point.
- `@rava/db` owns the domain schema, transactional outbox, audit log and repositories. Repository functions accept a pool or transaction executor.
- Generator-owned migrations are `0000_bootstrap.sql`, `0001_domain_model.sql` and `0002_glorious_agent_zero.sql`.
- Seed data is idempotent and explicitly development/demo data.

### Storefront and pricing

- Home, category, product and Persian/Latin search read PostgreSQL.
- Only verified, in-stock source offers participate in public estimates.
- Estimates persist/use FX snapshots and resolve integer pricing rules; unavailable inputs render an unavailable state rather than an invented price.
- Anonymous wishlist and recently viewed use cookies. Wishlist migrates idempotently into the signed-in account.
- SEO includes route metadata, canonical URLs, Open Graph, database-backed sitemap and robots exclusions.

### Authentication and customer account

- Email/password registration and login use Argon2id hashes, generic login failures, shared PostgreSQL rate limits and hashed HTTP-only session cookies.
- Single-use hashed tokens support email verification, password reset and mobile OTP with expiry and bounded attempts.
- Console email and fake SMS keep local development credential-free. Production providers remain behind swappable interfaces.
- Google OAuth routes are wired with state validation and are disabled in the UI until credentials exist. Verified identifiers are required before provider/phone linking.
- Dashboard, profile, delivery addresses, notification preferences and price-alert CRUD are database-backed.
- Product requests persist descriptions, links and budgets. Optional JPG/PNG/WebP images are limited to 5 MiB and stored privately through the S3-compatible abstraction.
- Internal account/request states shown to customers are rendered in Persian.
- The visual system now uses champagne gold as a visible secondary surface, supported by rose, peach and lilac tones translated from the supplied references; the system is documented in `docs/DESIGN_REFINEMENT.md`.
- Store navigation now exposes the cart as a primary destination in both the desktop header and mobile bottom navigation.
- Authentication uses one consistent two-state entry surface (`ورود` / `ثبت‌نام`): email/password remains the primary login path, password recovery stays contextual, and secondary OTP entry no longer competes on the main login screen.
- Anonymous visits to `/account` redirect directly to `/account/login`; `/account` is reserved for the signed-in dashboard.

### Cart, quote and deposit payment

- Cart survives anonymously through a signed cookie and binds to the account at sign-in. Only verified, in-stock offers can enter it; quantity is capped per line.
- Anonymous cart claiming merges duplicate variants into an existing account cart without exceeding the quantity cap.
- A quote is an immutable snapshot: FX snapshot id and rate, per-line cost breakdown, applied rule ids, calculation version and a 10-minute expiry. Issuing a new quote for a cart cancels the previous active one.
- Orders are created only inside one transaction that re-locks the quote, re-checks ownership of the address and revalidates every source offer against the price, shipping and stock the quote was built on. Any drift raises `SOURCE_CHANGED` and no order is written.
- The quote page shows a live countdown and, after expiry, refreshes and shows the difference before any payment.
- `FakePaymentGateway` implements the `PaymentGateway` interface. It redirects to a local approval screen that stands in for the bank, so the return trip is a real top-level browser navigation through the callback exactly as production behaves.
- Gateway callbacks are idempotent: a replayed callback returns without re-capturing, an amount mismatch is rejected, and only a `DEPOSIT_PENDING` order is payable. Success moves the order to `PROCUREMENT_PENDING`, records the paid deposit, appends status history and writes an outbox event in the same transaction.
- Checkout redirects use the active loopback host during local production-build QA, while deployed traffic remains pinned to the configured `APP_URL`. Pending orders expose a continuation action backed by the original persisted payment intent, so leaving the gateway never strands an order or creates a duplicate charge attempt.
- Card-to-card deposits accept a private JPG/PNG/WebP receipt up to 5 MiB and move the payment to `PENDING_VERIFICATION`. A receipt is evidence only and never credits money to the order.
- Receipt uploads validate file signatures as well as MIME and size; repository status guards reject late or concurrent uploads to completed payments.
- Checkout pages are `noindex`, and the development gateway accepts only the authority persisted for the owned payment.
- The worker refreshes the FX snapshot on an interval and logs each success or failure.

## Current architecture decisions

- Next.js App Router web app plus a separate worker inside the TypeScript monorepo; no premature microservices.
- Phase 6 is complete with centralized least-privilege RBAC and server-protected admin routes. Operational read/write models cover overview totals, orders, payment review, procurement, catalog, source offers, pricing rules, trips, customers, product requests, retailers, content, system health and the append-only audit log; every value comes from persisted rows.
- Card-to-card review is now a finance-only, reason-required transaction: approval validates the locked deposit, credits the order, creates idempotent buyer tasks, advances history, emits the outbox event and writes audit; rejection credits nothing and records its reason. Receipt bytes remain private and are streamed only through an authenticated, no-store staff route.
- Buyer actions (`assign to self`, `start`, `mark unavailable`, `complete purchase`) follow the domain state machines and write an audit event in the same transaction. Completing a purchase records integer EUR cents, the approved source/seller, a masked retailer reference and a private receipt; it then advances the immutable order item and, once every item is bought, the order itself. An unavailable item moves the order to customer reconfirmation instead of leaving the two views inconsistent. Gateway deposits and approved card receipts share one idempotent procurement-task factory so their queues cannot drift.
- Admin orders now have a dedicated immutable detail view containing the customer, locked financial snapshot, item-level procurement state and private purchase evidence. The customer order detail exposes the same item-level progress without exposing staff-only costs or documents.
- Procurement rows are created automatically from paid, locked orders. There is intentionally no free-form “add” button because that would bypass ownership, pricing and payment controls; a future manual-order/adjustment workflow must be separately permissioned and audited.
- Catalog publication, offer source verification, pricing-rule creation, retailer policy, trip operations, request handling and content publication are server-validated, role-scoped and audited. An unmatched offer cannot be marked verified.
- Orders purchased in Germany can be received into the Germany hub and moved into the trip queue in one audited transaction. Trip assignment writes item links, order history and an outbox event; only planned/collecting trips and `TRIP_PENDING` orders are eligible.
- The pricing editor exposes every persisted pricing factor while keeping the provider-owned live FX rate read-only. Money remains integer Toman/EUR cents and basis points.
- Staff roles are `OWNER`, `ADMIN`, `MERCHANDISER`, `BUYER_GERMANY`, `SUPPORT`, `FINANCE` and `CONTENT_EDITOR`. The legacy `OPERATOR` value remains read-only for migration compatibility and should be reassigned explicitly.
- The persistent storefront header owns a semantic inline search form; `/search` receives the query and renders results rather than acting as an intermediate query-entry step.
- Request-scoped composition stays in `apps/web/src/server`; pure policy stays in `@rava/domain`; persistence stays in `@rava/db`.
- Catalog pages are dynamic because price, stock and trip windows are live data.
- Cookie `Secure` flags derive from `APP_URL`, not `NODE_ENV`.
- Raw session, verification and OAuth-state secrets are not persisted; only hashes are stored where persistence is required.
- The Server Action multipart envelope is 6 MiB so application validation can enforce the documented 5 MiB image limit after framing overhead.
- Quote calculation version is currently `checkout-v1`; pricing-semantic changes require a new version instead of mutating locked snapshots.
- Fake gateway callbacks use the configured public origin in production and preserve the active localhost spelling during development.
- Next.js `16.3.1`, React `19.2.8`, pnpm `11.19.0`, Node.js 22+ and Drizzle ORM `0.45.2` remain pinned.

## Local environment notes

- Windows reserves port 5432 on this machine, so local PostgreSQL is published on `55432` through `.env` and `POSTGRES_HOST_PORT`.
- `pnpm-workspace.yaml` uses the local `.pnpm-store` to avoid redirected-profile prompts.
- The E2E runner owns port `3210`, so it does not collide with development port `3000`.
- Fake/dev providers remain active and do not block local development.
- Next development mode detects this checkout under `Downloads/Compressed` as a slow filesystem (roughly 300–750 ms on this machine). Cold route compilation can therefore take tens of seconds; production-build behavior is the meaningful baseline. Moving a working copy to a short local path such as `C:\dev\RAVA` is recommended but was not performed automatically.

## Open external credentials

- Production domain/host.
- Google OAuth.
- SMS and transactional email.
- Payment gateway.
- Telegram.
- Production FX provider.
- Production S3-compatible object storage.

## Known limitations

- Only the deposit is collected. Procurement purchase completion is implemented, but balance settlement, customer reconfirmation decisions, refunds, Germany dispatch, Iran arrival, local delivery and returns are later lifecycle slices.
- Card-to-card receipts remain `PENDING_VERIFICATION` until an authorized finance user approves or rejects them in the admin payment queue.
- The gateway is `FakePaymentGateway` behind the `PaymentGateway` interface, including a local approval screen that stands in for the bank. No production gateway is wired.
- Authenticity remains a presentation shell.
- Variant selection is not yet the interactive checkout selector.
- Recently viewed remains browser-local.
- Search is PostgreSQL `ILIKE`; trigram/typo tolerance is deferred.
- Catalog imagery is placeholder artwork and must be replaced with rights-cleared photography.
- Seeded retailer/offer/price data is demo data and must not be presented as observed production facts.
- Real Google, SMS, SMTP and production storage integrations cannot be end-to-end verified until credentials are supplied.
- `pnpm test` requires the local PostgreSQL infrastructure; `pnpm test:unit` does not.

## Latest verification (2026-08-26)

Passed after completing Phase 6 admin operations:

- `pnpm format`, `pnpm lint` and workspace-wide `pnpm typecheck`.
- `pnpm test` — 14 files and 163 tests passed, including all audited Phase 6 mutations and Germany-trip assignment.
- Production Next.js build — all 49 application routes compiled successfully, including nine new admin modules.
- `pnpm test:e2e` — all 23 tests passed, including authenticated OWNER access to every Phase 6 module at 390 px without horizontal overflow.
- Mobile admin capture: `docs/phase-6-admin-trips-390x844.png`.

Passed after the Phase 6 procurement-completion slice:

- `pnpm format`, `pnpm lint` and workspace-wide `pnpm typecheck`.
- `pnpm test` — 14 files and 161 tests passed, including transactional purchase completion, private evidence and unavailable-item customer reconfirmation.
- Production Next.js build — all 40 application routes compiled successfully, including admin order details and private purchase documents.
- `pnpm test:e2e` — all 22 storefront, account, checkout, RBAC and responsive tests passed.

Passed after the admin workspace/layout separation:

- `pnpm format:check`, `pnpm lint` and workspace-wide `pnpm typecheck`.
- `pnpm test` — 14 files and 160 tests passed.
- Production Next.js build — all 38 application routes compiled successfully.
- `pnpm test:e2e` — all 22 storefront, account, checkout, RBAC and responsive tests passed.
- Warm production checks on this machine: storefront 74–94 ms, health 8–12 ms and guest admin RBAC redirect 19–56 ms after first request.

Passed after Phase 5 hardening:

- `pnpm format` and `pnpm format:check`.
- `pnpm lint`.
- `pnpm typecheck` across all workspace packages.
- `pnpm test` — 14 files, 160 tests, including live PostgreSQL migrations, audited payment review/procurement actions, admin read models/RBAC, repositories, payment callbacks and upload-signature validation.
- `pnpm db:generate` — no schema drift.
- `pnpm db:migrate` against local PostgreSQL.
- `pnpm worker:smoke`.
- Production Next.js build — all application routes compiled, including the checkout, gateway and receipt routes.
- `pnpm test:e2e` — 22 tests covering the storefront, account journeys, admin denial for guests/customers, the full cart to locked quote to gateway deposit path, the card-to-card receipt path and responsive captures.
- Responsive authentication checks cover the simplified entry surface and cart discoverability at mobile and desktop widths.
- Visual review recorded in `docs/PHASE_5_UI_REVIEW.md`; captures are in `docs/phase-5-quote-390x844.png`, `docs/phase-5-order-390x844.png` and `docs/phase-5-card-receipt-390x844.png`.

The repository is versioned on GitHub at `danialRf/RAVA`; CI generates Next.js route types before TypeScript checking so a clean runner matches local verification.
CI uses the deterministic private-storage adapter because its service matrix does not run MinIO; local development continues to exercise MinIO through Docker Compose.

## Next phase

Begin Phase 7: complete customer reconfirmation choices, balance collection, Germany dispatch, Iran arrival, local delivery, cancellation/refund handling and customer notifications. Production provider credentials and rights-cleared product photography remain external launch dependencies.
