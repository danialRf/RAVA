# Testing & QA Strategy

## Quality principle

RAVA handles money and long-lived orders. Tests must cover domain state transitions, not only components.

## 1. Unit tests

High priority:
- pricing formula,
- margin/deposit rules,
- FX freshness/fallback,
- quote expiry,
- order transition guards,
- trust-tier policy,
- deal scoring,
- product matching deterministic paths,
- notification decisions.

## 2. Database/integration

Use test PostgreSQL.

Test:
- migrations from empty DB,
- constraints,
- transactional payment/order updates,
- outbox behavior,
- idempotency.

## 3. Provider contract tests

Fake implementations for:
- FX,
- payment,
- SMS,
- storage,
- Telegram,
- retailer adapter.

## 4. Scraper fixture tests

Each adapter:
- normal page,
- sale page,
- out-of-stock,
- missing field,
- changed/unexpected DOM.

A broken fixture must fail safely.

## 5. E2E Playwright

Critical customer flows:

### Browse → deposit
- mobile Persian,
- search product,
- open detail,
- add,
- fresh quote,
- fake gateway,
- successful deposit,
- order dashboard.

### Quote expiry
- quote expires,
- price refresh,
- user must see new amount.

### Card receipt
- upload,
- pending,
- admin approval,
- order updates.

### Procurement
- admin creates/assigns task,
- buyer marks purchased,
- evidence,
- customer timeline.

### Trip
- assign item,
- arrival,
- balance due.

### Admin auth/RBAC
Role cannot access forbidden actions.

## 6. Visual regression

Screenshots at:
- 360×800
- 390×844
- 430×932
- 768 tablet
- 1440 desktop

Key pages:
- home,
- listing,
- PDP,
- cart,
- quote,
- account order,
- admin deal inbox.

Review RTL/mixed text manually.

## 7. Accessibility

Automated checks where possible plus manual:
- keyboard,
- focus,
- labels,
- dialogs/drawers,
- contrast.

## 8. Performance

Avoid arbitrary perfect scores.

Track:
- LCP/CLS/INP,
- image weight,
- JS bundle,
- query counts,
- slow server routes.

## 9. Pre-phase gate

Before moving on:
- typecheck passes,
- lint passes,
- tests pass,
- no migration drift,
- no console error in tested flows,
- PROJECT_STATE updated.

## 10. Production smoke

After deploy:
- home,
- auth,
- search,
- FX freshness,
- fake/real payment in safe mode as applicable,
- admin login,
- worker heartbeat,
- queue,
- object upload,
- Telegram test destination if enabled.
