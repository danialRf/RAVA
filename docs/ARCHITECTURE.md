# RAVA Technical Architecture

## 1. Architecture strategy

Start as a **modular monorepo**, not microservices.

Reason:
RAVA needs multiple domains but has a small team and near-zero launch infrastructure budget.

Split into deployable processes only when execution characteristics differ.

## 2. Proposed repository

```text
rava/
  apps/
    web/            # Next.js storefront + account + admin
    worker/         # queues, scraping, alerts, rendering, Telegram jobs
  packages/
    db/             # Drizzle schema, migrations, repositories
    domain/         # pure business rules/types
    ui/             # RAVA design system
    config/         # env validation and shared config
    integrations/   # FX/payment/SMS/email/Telegram/storage providers
    scrapers/       # retailer adapter contracts + adapters
    content/        # templates/copy/card renderer contracts
  docs/
  prompts/
  docker/
```

Keep admin and storefront in the same Next.js app initially but separate route groups/layouts and permissions.

## 3. Technology

Use current stable production releases at implementation time and pin them in lockfile.

Preferred:
- TypeScript,
- Next.js App Router,
- React,
- PostgreSQL,
- Drizzle ORM,
- Redis,
- BullMQ,
- Crawlee,
- Playwright fallback,
- Zod,
- Playwright Test,
- Vitest,
- S3-compatible object storage.

Search:
- start with PostgreSQL full-text/trigram features,
- add self-hosted Typesense in the advanced-search phase if needed.

## 4. Processes

### Web
Handles:
- SSR/RSC pages,
- customer API/actions,
- admin UI,
- quote requests,
- authentication,
- checkout,
- read-heavy catalog operations.

### Worker
Handles:
- retailer crawling,
- normalization,
- price history,
- deal scoring,
- background alerts,
- Telegram publishing,
- marketing-card rendering,
- scheduled FX fetches,
- email/SMS jobs.

Never run long browser crawling inside a web request.

## 5. Data stores

PostgreSQL:
system of record.

Redis:
- queues,
- short-lived quote locks/cache,
- rate limiting,
- distributed locks where needed.

Object storage:
- product media copies where allowed,
- customer request screenshots,
- payment receipts,
- purchase receipts,
- generated marketing cards.

Private documents must be in private buckets/keys with signed access.

## 6. Provider abstraction

```text
FxRateProvider
PaymentGateway
SmsProvider
EmailProvider
ObjectStorageProvider
TelegramPublisher
ContentGenerator
MarketingCardRenderer
RetailerAdapter
```

All providers need:
- production implementation,
- fake/dev implementation,
- health/status reporting,
- timeout/retry policy.

## 7. Jobs

Suggested queues:
- `fx`
- `retailer-crawl`
- `offer-normalization`
- `deal-scoring`
- `content`
- `card-render`
- `publish`
- `notifications`
- `maintenance`

Jobs need:
- idempotency key,
- max attempts,
- backoff,
- dead-letter/failure visibility,
- structured logs.

## 8. Deployment stages

### Local
Docker Compose:
- PostgreSQL,
- Redis,
- optional Typesense,
- MinIO/S3 emulator,
- mail catcher.

Web/worker can run on host or Docker.

### Early production
One capable VPS can run:
- reverse proxy,
- web,
- worker,
- PostgreSQL,
- Redis,
- object storage or external S3-compatible service.

Prefer managed backup even if runtime is self-hosted.

### Growth
Split:
- database,
- object storage,
- crawling workers,
- search,
- app nodes.

Architecture must not assume a single host forever.

## 9. Events

Domain events improve decoupling:

Examples:
- `offer.discovered`
- `offer.price_changed`
- `offer.out_of_stock`
- `product.published`
- `quote.created`
- `deposit.paid`
- `order.procurement_required`
- `purchase.confirmed`
- `trip.assigned`
- `order.arrived_iran`
- `balance.due`
- `order.delivered`

Initially these can be transactional outbox rows + worker dispatch, not a full Kafka system.

## 10. Transactional outbox

For money/order state transitions:
1. update state and insert outbox event in one DB transaction,
2. worker publishes/processes event,
3. mark outbox delivered.

This prevents “payment succeeded but notification/order job disappeared” inconsistencies.

## 11. API philosophy

Prefer server-side actions/route handlers for internal web operations.

For integration boundaries, define explicit versioned endpoints.

Do not expose admin internals in public client bundles.

## 12. Environment strategy

- `.env.example` committed,
- real `.env` ignored,
- startup validates required vars,
- fake providers default in local dev.

## 13. Observability

Launch:
- structured JSON logs,
- request IDs,
- job IDs,
- scraper run dashboards in admin,
- error table/health page.

Optional later:
- Sentry/OpenTelemetry.

Do not require paid observability to start.

## 14. Architectural principle

Build abstractions around **volatile boundaries**:
retailers, payments, FX, SMS, AI.

Do not abstract every React component or tiny helper.
