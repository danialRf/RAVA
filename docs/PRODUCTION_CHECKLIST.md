# RAVA production checklist

RAVA is code-complete for the deliberately small launch scope. It is not live
until every external blocker below is supplied and verified in staging.

## Mandatory before accepting customers

- Set a real HTTPS `APP_URL` and a long random `AUTH_SECRET`.
- Provision managed PostgreSQL with automated daily backups and test one restore.
- Provision managed Redis and S3-compatible private/public buckets.
- Configure the real payment provider and test success, cancellation, callback
  replay, amount mismatch, balance payment and refund reconciliation.
- Configure transactional email and SMS; verify opt-out preferences and failure
  visibility.
- Replace demo catalog facts and placeholder artwork with reviewed, rights-cleared
  data. Never publish seeded rows as observed retailer facts.
- Create named staff accounts with least-privilege roles; remove shared credentials.
- Run `pnpm check:production`, migrations, the full test suite and smoke checks in
  staging using production-equivalent services.
- Put the web process behind TLS/reverse proxy and run the worker as a separate
  continuously supervised process from the same release image.

## Release procedure

1. Back up the database and record the deployed commit SHA.
2. Build the immutable Docker image once.
3. Apply forward-only migrations before switching web traffic.
4. Start the worker, then the web service, and check `/health`.
5. Smoke-test registration, search, quote, deposit, procurement, balance and
   delivery using a non-production payment amount/account.
6. Monitor structured logs, failed outbox rows and payment reconciliation.

## Recovery

- Roll application containers back to the previous image only when its schema is
  compatible. Database changes are recovered through reviewed forward migrations;
  never edit production migration history.
- If payment callbacks fail, stop new checkout traffic, retain the callback and
  payment rows, reconcile by provider reference and replay idempotently.
- If the worker fails, restart it under supervision. Persisted jobs/outbox rows are
  the recovery source; do not manufacture customer status changes manually.
- Restore into a new database first, verify counts and payment/order consistency,
  then switch the connection string during a maintenance window.

## Explicit post-launch backlog

The following are useful but are not launch requirements: live retailer scraping,
multi-source deal scoring, generated marketing cards, Telegram publishing,
Typesense, advanced personalization, loyalty/referrals and analytics dashboards.

