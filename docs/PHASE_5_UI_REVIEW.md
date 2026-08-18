# Phase 5 UI Review

Date: 2026-08-18

## Reviewed paths

- Product to persistent cart.
- Authentication hand-off without losing the anonymous cart.
- Delivery-address selection.
- Ten-minute quote with live countdown and immutable price summary.
- Fake gateway deposit callback and procurement-pending order.
- Card-to-card receipt upload and pending finance-review state.
- Customer order list and order detail.

## Mobile checks

The critical checkout flow was exercised at `390 × 844` with Persian/RTL
content, mixed Latin product strings and Toman amounts. Captures:

- `phase-5-quote-390x844.png`
- `phase-5-order-390x844.png`
- `phase-5-card-receipt-390x844.png`

Controls use semantic forms, labels, status messages and an accessible timer.
Private checkout and order pages are excluded from indexing.

## Behavior verified

- Public cart prices remain explicitly estimated.
- A quote requires a signed-in customer, usable source offer and FX snapshot no
  older than five minutes.
- The quote shows its ten-minute expiry and is revalidated before order creation.
- The fake gateway callback is idempotent and records one financial effect.
- A successful deposit moves the order to procurement pending.
- A card-to-card receipt is stored privately and does not mark money as paid.
- Orders can only be read by their owner.

## Deferred work

- A production payment gateway will replace the fake provider once credentials
  and callback rules are supplied.
- Final bank-account copy is intentionally absent until verified business
  account details are supplied.
- Production photography remains a separate content task.
