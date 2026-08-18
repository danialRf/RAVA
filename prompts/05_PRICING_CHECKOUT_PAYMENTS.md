# Phase 5 — FX, Quotes, Deposit Checkout, Payment Abstraction

Implement `PRICING_ENGINE.md` and payment architecture.

FX:
- provider interface,
- fake provider,
- manual admin fallback data path,
- cache/freshness,
- scheduled fetch job skeleton.

Pricing:
- rule resolution,
- transport/risk/margin/deposit,
- calculator version,
- admin-safe breakdown service.

Quote:
- revalidate source offer,
- fresh FX requirement,
- default 10-minute expiry,
- immutable snapshot,
- countdown UI,
- refresh-and-show-difference UX.

Checkout:
- cart → quote → deposit,
- FakePaymentGateway,
- gateway abstraction,
- card-to-card receipt upload,
- idempotent callbacks,
- payment ledger.

Order:
- create only from valid quote,
- deposit paid transition,
- procurement pending.

Build price simulator tests with edge cases.

Update PROJECT_STATE.
