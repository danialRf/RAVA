# Phase 2 — Domain Model + Database

Implement the database/domain foundation from `DATABASE_SPEC.md`.

Requirements:
- Drizzle PostgreSQL schema,
- reviewable SQL migrations,
- repositories/services for key domain entities,
- integer money types/helpers,
- canonical enums for order/offer/payment/procurement/trip states,
- pricing rule tables,
- FX snapshots,
- retailer/seller/offer/price-history tables,
- product/variant/media,
- users/account base,
- quotes/orders/payments,
- procurement/trips,
- audit log/outbox,
- seed script with realistic Persian-safe demo data.

Implement domain transition guards as pure tested code.

Do not implement real payment/scraping yet.

Tests:
- migration from empty DB,
- constraints,
- money helpers,
- transition guards,
- repository integration tests.

Update PROJECT_STATE.
