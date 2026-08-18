# Pricing & FX Engine

Pricing is a core trust feature.

## 1. Customer-facing model

Browsing pages show an **estimated** Toman price.

Example:

**حدود ۸٬۹۵۰٬۰۰۰ تومان**

Helper:
`قیمت نهایی با نرخ به‌روز هنگام ثبت سفارش محاسبه می‌شود.`

At checkout, RAVA produces a short-lived exact quote.

Default quote validity:
**10 minutes**, configurable.

## 2. Why EUR, not only USD

Most source offers are priced in EUR.

The preferred pricing engine should use a direct `EUR → Toman` sell/service rate when available.

A USD cross-rate can exist as fallback, but should not be the primary model when a trustworthy direct EUR rate is available.

## 3. FX provider contract

```ts
interface FxRateProvider {
  getRate(input: {
    base: "EUR";
    quote: "TOMAN";
    side: "SELL";
  }): Promise<{
    rate: bigint;
    providerTimestamp: Date;
    fetchedAt: Date;
    sourceId: string;
  }>;
}
```

Implement:
- fake dev provider,
- manual admin provider,
- one real provider adapter later.

Provider order:
1. configured primary API,
2. configured secondary API,
3. fresh cached rate,
4. manual rate,
5. if none safe: disable instant checkout and require price inquiry.

## 4. Freshness

Storefront estimate:
- may use cached FX,
- default max age e.g. 15 minutes.

Checkout:
- requires fresh rate,
- default max age 5 minutes.
- if provider unavailable, use configured safe fallback only if admin policy permits.

Do not promise “second-by-second” if the selected data provider does not supply that frequency.

## 5. Cost components

For one unit:

- source product EUR price,
- German domestic shipping allocation,
- FX conversion,
- FX safety buffer/spread,
- Germany→Iran transport allocation,
- customs/duty/risk reserve,
- payment gateway fee,
- Iran local delivery where included,
- target contribution margin,
- minimum absolute profit.

## 6. Transport classes

Example configurable classes:

- XS: cosmetics/accessories
- S: perfume/small shoes/accessories
- M: sneaker/clothing/bag
- L: bulky but permitted
- BLOCKED: too heavy/large

Each class can define:
- flat Toman estimate,
- per-gram amount,
- volume surcharge,
- risk reserve.

Do not infer shipping solely from retail category if weight data is known.

## 7. Recommended formula

Use transparent components.

```text
source_eur_total =
  source_price_eur
  + germany_shipping_allocation_eur

source_toman =
  source_eur_total
  × effective_eur_toman_rate

pre_margin_cost =
  source_toman
  + germany_to_iran_transport
  + customs_and_risk_reserve
  + iran_delivery_cost

recommended_sell_price =
  max(
    pre_margin_cost / (1 - target_margin_rate - payment_fee_rate),
    pre_margin_cost + minimum_profit_toman
  )

final =
  round_up(recommended_sell_price, configured_rounding_unit)
```

This uses target **margin**, not ambiguous markup.

Admin should show both:
- target margin,
- resulting markup,
- projected gross profit.

## 8. Pricing rules

Resolve most-specific active rule:

1. product override
2. brand+category/price band
3. category
4. source trust tier
5. global default

Every quote stores:
- rule IDs used,
- calculation version,
- cost breakdown.

## 9. Deposit

Default launch recommendation:
**35%**.

Configurable by rule:
- low-risk/common: 33–35%
- higher-risk/special order: 40–50%
- very expensive/rare: manual rule

Also support:
- minimum deposit Toman,
- manual admin override with audit entry.

The deposit is a business-risk decision; the admin must see whether it covers enough procurement exposure.

## 10. Locking behavior

Recommended UX:

1. public price = estimate,
2. checkout quote = locked for 10 min,
3. customer pays deposit,
4. procurement is attempted promptly,
5. after successful procurement, order total is frozen in Toman,
6. remaining balance does not move with later FX changes.

If procurement fails or price changes outside tolerance before purchase:
- do not silently recalculate,
- request customer reconfirmation or refund.

## 11. Source price volatility

Quote includes:
- source offer ID,
- source price snapshot,
- observed time.

Before finalizing deposit:
- optionally revalidate source stock/price.

Before buyer purchase:
- show allowed max source price.

## 12. Rounding

Use configurable customer-friendly rounding:
for example nearest/up to 10,000 Toman.

Never round underlying audit calculations prematurely.

## 13. Admin pricing simulator

Admin can input:
- EUR source price,
- category,
- source,
- weight,
- FX,
- margin.

Show:
- estimated landed cost,
- suggested sale price,
- deposit,
- projected profit,
- sensitivity at +5%/+10% FX.

## 14. Price history

Store:
- retailer EUR price history,
- RAVA estimated Toman history optionally,
- exchange rate separately.

Do not market a fake “discount” caused only by FX movements.
