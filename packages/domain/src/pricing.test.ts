import { describe, expect, it } from "vitest";

import { MoneyError } from "./money";
import {
  estimatePrice,
  PricingError,
  simulatePriceSensitivity,
  sourceDiscountBps,
  TRANSPORT_TARIFFS,
  type EstimateRule,
} from "./pricing";

const rule: EstimateRule = {
  targetMarginBps: 2_200,
  minProfitToman: 300_000n,
  customsRiskBps: 400,
  fxBufferBps: 250,
  paymentFeeBps: 350,
  depositBps: 3_500,
  minDepositToman: 500_000n,
  roundingUnitToman: 10_000n,
  transportClass: "M",
};

const baseInput = {
  sourcePriceEurCents: 10_995n,
  shippingEurCents: 0n,
  tomanPerEur: 200_000n,
  rule,
  weightGrams: 950,
} as const;

describe("estimatePrice", () => {
  it("produces a rounded estimate with a reconstructable breakdown", () => {
    const result = estimatePrice(baseInput);

    expect(result.estimatedToman % rule.roundingUnitToman).toBe(0n);
    expect(result.estimatedToman).toBeGreaterThan(result.preMarginToman);
    // Every component must add back up to the customer price.
    expect(
      result.preMarginToman + result.marginToman + result.paymentFeeToman,
    ).toBe(result.estimatedToman);
    expect(result.depositToman + result.balanceToman).toBe(
      result.estimatedToman,
    );
  });

  it("applies the FX buffer to the rate, not to the margin", () => {
    const result = estimatePrice(baseInput);
    expect(result.effectiveTomanPerEur).toBe(205_000n);

    const withoutBuffer = estimatePrice({
      ...baseInput,
      rule: { ...rule, fxBufferBps: 0 },
    });
    expect(withoutBuffer.effectiveTomanPerEur).toBe(200_000n);
    expect(withoutBuffer.sourceToman).toBeLessThan(result.sourceToman);
  });

  it("charges transport by class and weight", () => {
    const light = estimatePrice({ ...baseInput, weightGrams: 100 });
    const heavy = estimatePrice({ ...baseInput, weightGrams: 2_000 });
    expect(heavy.transportToman).toBeGreaterThan(light.transportToman);

    const tariff = TRANSPORT_TARIFFS.M;
    expect(light.transportToman).toBe(
      tariff.flatToman + tariff.perGramToman * 100n,
    );
  });

  it("falls back to the flat tariff when weight is unknown", () => {
    const unknown = estimatePrice({ ...baseInput, weightGrams: undefined });
    expect(unknown.transportToman).toBe(TRANSPORT_TARIFFS.M.flatToman);
  });

  it("includes shipping charged by the source retailer", () => {
    const withShipping = estimatePrice({
      ...baseInput,
      shippingEurCents: 499n,
    });
    expect(withShipping.sourceEurCents).toBe(11_494n);
    expect(withShipping.estimatedToman).toBeGreaterThan(
      estimatePrice(baseInput).estimatedToman,
    );
  });

  it("honours the minimum absolute profit on cheap items", () => {
    const cheap = estimatePrice({
      ...baseInput,
      sourcePriceEurCents: 500n,
      weightGrams: 100,
      rule: { ...rule, minProfitToman: 3_000_000n },
    });
    expect(cheap.estimatedToman - cheap.preMarginToman).toBeGreaterThanOrEqual(
      3_000_000n,
    );
  });

  it("keeps the realised margin at or above the target", () => {
    const result = estimatePrice(baseInput);
    const targetMargin =
      (result.estimatedToman * BigInt(rule.targetMarginBps)) / 10_000n;
    expect(result.marginToman).toBeGreaterThanOrEqual(targetMargin - 10_000n);
  });

  it("never produces a deposit above the estimate", () => {
    const result = estimatePrice({
      ...baseInput,
      sourcePriceEurCents: 100n,
      rule: { ...rule, depositBps: 10_000, minDepositToman: 50_000_000n },
    });
    expect(result.depositToman).toBe(result.estimatedToman);
    expect(result.balanceToman).toBe(0n);
  });

  it("is deterministic", () => {
    expect(estimatePrice(baseInput)).toEqual(estimatePrice(baseInput));
  });

  it("refuses to price blocked, free or rate-less inputs", () => {
    expect(() =>
      estimatePrice({
        ...baseInput,
        rule: { ...rule, transportClass: "BLOCKED" },
      }),
    ).toThrow(PricingError);

    expect(() =>
      estimatePrice({ ...baseInput, sourcePriceEurCents: 0n }),
    ).toThrow(PricingError);

    expect(() => estimatePrice({ ...baseInput, tomanPerEur: 0n })).toThrow(
      MoneyError,
    );

    expect(() =>
      estimatePrice({
        ...baseInput,
        rule: { ...rule, targetMarginBps: 9_000, paymentFeeBps: 1_000 },
      }),
    ).toThrow(PricingError);
  });
});

describe("sourceDiscountBps", () => {
  it("reports a genuine source price drop", () => {
    expect(sourceDiscountBps(8_000n, 10_000n)).toBe(2_000);
  });

  it("returns null when there is nothing factual to claim", () => {
    expect(sourceDiscountBps(10_000n, null)).toBeNull();
    expect(sourceDiscountBps(10_000n, undefined)).toBeNull();
    expect(sourceDiscountBps(10_000n, 10_000n)).toBeNull();
    expect(sourceDiscountBps(12_000n, 10_000n)).toBeNull();
  });
});

describe("simulatePriceSensitivity", () => {
  it("reuses the production calculator for current, +5% and +10% FX", () => {
    const scenarios = simulatePriceSensitivity(baseInput);

    expect(scenarios.map((scenario) => scenario.tomanPerEur)).toEqual([
      200_000n,
      210_000n,
      220_000n,
    ]);
    expect(scenarios[0]?.breakdown).toEqual(estimatePrice(baseInput));
    expect(scenarios[1]!.breakdown.estimatedToman).toBeGreaterThan(
      scenarios[0]!.breakdown.estimatedToman,
    );
    expect(scenarios[2]!.breakdown.estimatedToman).toBeGreaterThan(
      scenarios[1]!.breakdown.estimatedToman,
    );
  });

  it("preserves integer money and deposit invariants in every scenario", () => {
    for (const scenario of simulatePriceSensitivity(baseInput)) {
      expect(scenario.breakdown.estimatedToman % rule.roundingUnitToman).toBe(
        0n,
      );
      expect(
        scenario.breakdown.depositToman + scenario.breakdown.balanceToman,
      ).toBe(scenario.breakdown.estimatedToman);
    }
  });
});
