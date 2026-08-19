# Project State

Codex must update this file after every phase.

## Architecture and performance hardening (in progress)

- Storefront pricing now loads the active pricing-rule set once per server render and resolves product/category/brand/price-band precedence in a pure selector. Product grids no longer issue one pricing-rule query per product.
- The selector has focused tests for specificity, priority/time tie-breaking and half-open price bands. Application-service boundaries, storefront caching/search indexes and CI runtime remain the next hardening milestones.
- CI caches the Playwright browser separately from OS dependencies and performs one production build instead of rebuilding immediately before E2E.
- Account pages read through a dedicated server-side application service instead of receiving database handles. Stable public taxonomy uses a bounded five-minute server cache; product money/stock rows, personalized data, checkout and payment remain uncached because integer money must not pass through a JSON-only cache boundary.
- PostgreSQL trigram indexes cover Persian/original titles, descriptions and brand names so the launch `ILIKE` search path remains usable as the catalog grows.

## Current phase

`PHASE_5_CHECKOUT_PAYMENTS_COMPLETE`

## Completed

- Phase 0 repository bootstrap and local infrastructure verification — 2026-08-14.
- Phase 1 reusable Persian-first storefront and design system — 2026-08-14.
- Phase 2 domain model and PostgreSQL implementation — 2026-08-16.
- Phase 3 database-backed catalog storefront — 2026-08-17.
- Phase 4 authentication and customer accounts — 2026-08-18.
- Phase 5 cart, binding quote and deposit payment — 2026-08-18.
- Beauty-editorial storefront art direction and Vazirmatn/B-Vazir typography refinement — 2026-08-18.

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

## Open external credentials

- Production domain/host.
- Google OAuth.
- SMS and transactional email.
- Payment gateway.
- Telegram.
- Production FX provider.
- Production S3-compatible object storage.

## Known limitations

- Only the deposit is collected. Balance settlement, refunds and the remaining order lifecycle beyond `PROCUREMENT_PENDING` are later phases.
- Card-to-card receipts are stored and marked `PENDING_VERIFICATION`; the operator screen that approves them arrives with the admin (Phase 6).
- The gateway is `FakePaymentGateway` behind the `PaymentGateway` interface, including a local approval screen that stands in for the bank. No production gateway is wired.
- Authenticity remains a presentation shell.
- Variant selection is not yet the interactive checkout selector.
- Recently viewed remains browser-local.
- Search is PostgreSQL `ILIKE`; trigram/typo tolerance is deferred.
- Catalog imagery is placeholder artwork and must be replaced with rights-cleared photography.
- Seeded retailer/offer/price data is demo data and must not be presented as observed production facts.
- Real Google, SMS, SMTP and production storage integrations cannot be end-to-end verified until credentials are supplied.
- `pnpm test` requires the local PostgreSQL infrastructure; `pnpm test:unit` does not.

## Latest verification (2026-08-19)

Passed after Phase 5 hardening:

- `pnpm format` and `pnpm format:check`.
- `pnpm lint`.
- `pnpm typecheck` across all workspace packages.
- `pnpm test` — 11 files, 149 tests, including live PostgreSQL migrations, repositories, payment callbacks and upload-signature validation.
- `pnpm db:generate` — no schema drift.
- `pnpm db:migrate` against local PostgreSQL.
- `pnpm worker:smoke`.
- Production Next.js build — all application routes compiled, including the checkout, gateway and receipt routes.
- `pnpm test:e2e` — 20 tests covering the storefront, account journeys, the full cart to locked quote to gateway deposit path, the card-to-card receipt path and responsive captures.
- Responsive authentication checks cover the simplified entry surface and cart discoverability at mobile and desktop widths.
- Visual review recorded in `docs/PHASE_5_UI_REVIEW.md`; captures are in `docs/phase-5-quote-390x844.png`, `docs/phase-5-order-390x844.png` and `docs/phase-5-card-receipt-390x844.png`.

The repository is versioned on GitHub at `danialRf/RAVA`; CI generates Next.js route types before TypeScript checking so a clean runner matches local verification.
CI uses the deterministic private-storage adapter because its service matrix does not run MinIO; local development continues to exercise MinIO through Docker Compose.

## Next phase

Phase 6 — admin operating system (`prompts/06_ADMIN_OS.md`), including the pricing-settings screen that lets an admin edit every pricing factor except the live FX rate.
