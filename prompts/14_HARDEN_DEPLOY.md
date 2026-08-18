# Phase 14 — Production Hardening & Deployment

Prepare production without inventing credentials.

Tasks:
- dependency/security audit,
- strict env validation,
- CSP/security headers,
- auth review,
- payment idempotency/reconciliation review,
- upload security,
- SSRF protection,
- DB indexes/query review,
- backups/restore instructions,
- worker failure recovery,
- dead-letter/admin visibility,
- structured logging,
- health/readiness,
- Docker production build,
- reverse proxy/TLS plan,
- staging deployment documentation,
- production runbook,
- migration rollback/forward strategy,
- smoke tests.

External services can remain fake/disabled until credentials are provided.

Create `docs/PRODUCTION_CHECKLIST.md`.

Run full test suite and E2E.

Update PROJECT_STATE to production-ready-with-listed-external-blockers, not falsely “live”.
