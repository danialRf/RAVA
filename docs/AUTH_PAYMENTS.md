# Authentication, Payments & Notifications

## Authentication

Desired customer methods:
- email + password,
- Google,
- mobile OTP.

Use an established auth library for sessions/OAuth.

### Email/password
- Argon2id or library-recommended strong password hashing.
- verification/reset flows.
- rate limiting.

### Google
Use standard OpenID/OAuth provider flow through chosen auth library.
Request only identity scopes required for login.

### Mobile OTP
Create a custom `SmsProvider` interface.

Local development:
- fake OTP provider writes code to dev console/test harness only.

Production:
- plug in selected Iranian SMS provider later.

Never block the rest of development waiting for SMS credentials.

## Account linking

A customer can potentially have:
- Google identity,
- password identity,
- phone.

Prevent accidental duplicate accounts through explicit verified linking rules.

## Payment methods

Launch support:
1. Iranian payment gateway,
2. card-to-card receipt upload.

No cryptocurrency.

## Gateway abstraction

```ts
interface PaymentGateway {
  createPayment(input: PaymentRequest): Promise<PaymentRedirect>;
  verifyPayment(input: PaymentCallback): Promise<VerifiedPayment>;
}
```

Dev:
`FakePaymentGateway`

Production:
implement selected Iranian provider only after merchant credentials/API docs are available.

## Payment correctness

- create local payment intent before redirect,
- amount comes from server-side order/quote only,
- callback is not trusted by itself,
- server verifies with provider,
- amount/reference must match,
- idempotent verification,
- duplicate callbacks harmless.

## Deposit vs balance

Each order has separate payment intents/ledger events for:
- DEPOSIT,
- BALANCE,
- REFUND.

Do not overwrite one “paid” boolean.

## Card-to-card

Customer:
- selects method,
- sees amount/account instructions,
- uploads receipt/reference,
- payment state becomes `REVIEW_PENDING`.

Admin:
- inspect private receipt,
- approve/reject,
- record reason.

Do not expose uploaded receipts publicly.

## Notifications

Provider interfaces:
- in-app,
- email,
- SMS,
- Telegram later if user links/opts in.

Important transactional events:
- deposit received,
- procurement confirmed,
- source problem/reconfirmation,
- received in Germany,
- assigned to trip,
- arrived in Iran,
- balance due,
- local delivery,
- delivered/refund.

## Telegram channel publishing

Separate from private customer notification.

Bot publisher stores:
- destination,
- message ID,
- caption hash,
- published_at,
- edit/delete state.

Admin preview before launch publication.

Later auto-publish policy can be introduced.

## External credentials checklist

Production requires owner-provided:
- Google OAuth client,
- SMS provider,
- payment merchant,
- Telegram bot token/channel,
- email provider if used.
