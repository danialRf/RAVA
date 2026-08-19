import { describe, expect, it } from "vitest";

import type { PricingRule } from "./pricing";
import { selectPricingRule } from "./pricing";

const now = new Date("2026-08-19T12:00:00Z");

function rule(
  id: string,
  scope: PricingRule["scope"],
  overrides: Partial<PricingRule> = {},
): PricingRule {
  return {
    id,
    scope,
    categoryId: null,
    brandId: null,
    productId: null,
    trustTier: null,
    priceBandMinEurCents: null,
    priceBandMaxEurCents: null,
    priority: 0,
    targetMarginBps: 2_000,
    minProfitToman: 100_000n,
    transportClass: "S",
    customsRiskBps: 0,
    fxBufferBps: 0,
    paymentFeeBps: 0,
    depositBps: 3_500,
    minDepositToman: 0n,
    roundingUnitToman: 10_000n,
    activeFrom: now,
    activeTo: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("selectPricingRule", () => {
  it("selects the most specific matching rule", () => {
    const rules = [
      rule("global", "GLOBAL"),
      rule("category", "CATEGORY", { categoryId: "category-1" }),
      rule("product", "PRODUCT", { productId: "product-1" }),
    ];

    expect(
      selectPricingRule(rules, {
        productId: "product-1",
        brandId: "brand-1",
        categoryId: "category-1",
        sourcePriceEurCents: 5_000n,
      })?.id,
    ).toBe("product");
  });

  it("uses priority and active time as deterministic tie breakers", () => {
    const rules = [
      rule("older", "GLOBAL", { priority: 2 }),
      rule("newer", "GLOBAL", {
        priority: 2,
        activeFrom: new Date(now.getTime() + 1_000),
      }),
      rule("lower-priority", "GLOBAL", { priority: 1 }),
    ];

    expect(selectPricingRule(rules, {})?.id).toBe("newer");
  });

  it("applies half-open price bands", () => {
    const rules = [
      rule("band", "PRICE_BAND", {
        priceBandMinEurCents: 1_000n,
        priceBandMaxEurCents: 2_000n,
      }),
      rule("global", "GLOBAL"),
    ];

    expect(selectPricingRule(rules, { sourcePriceEurCents: 1_999n })?.id).toBe(
      "band",
    );
    expect(selectPricingRule(rules, { sourcePriceEurCents: 2_000n })?.id).toBe(
      "global",
    );
  });
});
