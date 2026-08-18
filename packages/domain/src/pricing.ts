/**
 * Estimated-price calculation.
 *
 * This is the browsing-time estimate described in docs/PRICING_ENGINE.md, not
 * the binding checkout quote (Phase 5). It is a pure function of an observed
 * source offer, an FX snapshot and a pricing rule, so the same inputs always
 * produce the same number and every component can be shown to an operator.
 *
 * Nothing here guesses: a caller without an offer, without a fresh rate or
 * without a rule must render "price unavailable" rather than call this.
 */

import type { TransportClass } from "./enums";
import {
  addBps,
  applyBps,
  BPS_DENOMINATOR,
  convertEurCentsToToman,
  depositAmount,
  divideRoundHalfUp,
  MoneyError,
  roundUpToUnit,
  type EurCents,
  type Toman,
} from "./money";

/** Cost of moving one item from Germany to Iran, per transport class. */
export interface TransportTariff {
  readonly flatToman: Toman;
  readonly perGramToman: Toman;
}

/**
 * Launch defaults. These are business configuration and are expected to move
 * to the database once the admin can edit them; BLOCKED has no tariff because
 * such items must never be offered.
 */
export const TRANSPORT_TARIFFS: Readonly<
  Record<Exclude<TransportClass, "BLOCKED">, TransportTariff>
> = {
  XS: { flatToman: 250_000n, perGramToman: 900n },
  S: { flatToman: 400_000n, perGramToman: 950n },
  M: { flatToman: 650_000n, perGramToman: 1_000n },
  L: { flatToman: 1_200_000n, perGramToman: 1_100n },
};

export interface EstimateRule {
  readonly targetMarginBps: number;
  readonly minProfitToman: Toman;
  readonly customsRiskBps: number;
  readonly fxBufferBps: number;
  readonly paymentFeeBps: number;
  readonly depositBps: number;
  readonly minDepositToman: Toman;
  readonly roundingUnitToman: Toman;
  readonly transportClass: TransportClass;
}

export interface EstimateInput {
  readonly sourcePriceEurCents: EurCents;
  readonly shippingEurCents?: EurCents;
  /** Integer Toman per one EUR, from a stored FX snapshot. */
  readonly tomanPerEur: bigint;
  readonly rule: EstimateRule;
  /** Actual weight when known; falls back to the class flat rate only. */
  readonly weightGrams?: number | undefined;
  readonly localDeliveryToman?: Toman;
  /** Overrides the launch tariff table, e.g. from admin configuration. */
  readonly transportTariff?: TransportTariff;
}

/** Every component is retained so the admin can explain any price. */
export interface EstimateBreakdown {
  readonly sourceEurCents: EurCents;
  readonly effectiveTomanPerEur: bigint;
  readonly sourceToman: Toman;
  readonly transportToman: Toman;
  readonly customsRiskToman: Toman;
  readonly localDeliveryToman: Toman;
  readonly preMarginToman: Toman;
  readonly marginToman: Toman;
  readonly paymentFeeToman: Toman;
  readonly estimatedToman: Toman;
  readonly depositToman: Toman;
  readonly balanceToman: Toman;
}

export interface PriceSensitivityScenario {
  readonly label: "current" | "fx-plus-5" | "fx-plus-10";
  readonly tomanPerEur: bigint;
  readonly breakdown: EstimateBreakdown;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

/**
 * Computes the customer-facing estimate and its full cost breakdown.
 *
 * The sell price is derived from a target *margin*, not a markup, and is then
 * floored by the minimum absolute profit so cheap items stay worth sourcing.
 */
export function estimatePrice(input: EstimateInput): EstimateBreakdown {
  const { rule } = input;

  if (rule.transportClass === "BLOCKED") {
    throw new PricingError("Blocked transport class cannot be priced");
  }
  if (rule.targetMarginBps + rule.paymentFeeBps >= Number(BPS_DENOMINATOR)) {
    throw new PricingError("Margin and payment fee cannot consume the price");
  }
  if (input.tomanPerEur <= 0n) {
    throw new MoneyError("Toman per EUR rate must be positive");
  }

  const sourceEurCents =
    input.sourcePriceEurCents + (input.shippingEurCents ?? 0n);
  if (sourceEurCents <= 0n) {
    throw new PricingError("Source price must be positive");
  }

  // The buffer protects the margin against rate movement between browsing and
  // checkout; it is applied to the rate, never hidden inside the margin.
  const effectiveTomanPerEur = addBps(input.tomanPerEur, rule.fxBufferBps);
  const sourceToman = convertEurCentsToToman(
    sourceEurCents,
    effectiveTomanPerEur,
  );

  const tariff =
    input.transportTariff ?? TRANSPORT_TARIFFS[rule.transportClass];
  const weightGrams = BigInt(Math.max(0, Math.trunc(input.weightGrams ?? 0)));
  const transportToman = tariff.flatToman + tariff.perGramToman * weightGrams;

  const customsRiskToman = applyBps(sourceToman, rule.customsRiskBps);
  const localDeliveryToman = input.localDeliveryToman ?? 0n;
  const preMarginToman =
    sourceToman + transportToman + customsRiskToman + localDeliveryToman;

  const retainedBps =
    Number(BPS_DENOMINATOR) - rule.targetMarginBps - rule.paymentFeeBps;
  const marginDerived = divideRoundHalfUp(
    preMarginToman * BPS_DENOMINATOR,
    BigInt(retainedBps),
  );
  const profitFloored = preMarginToman + rule.minProfitToman;
  const recommended =
    marginDerived > profitFloored ? marginDerived : profitFloored;

  const estimatedToman = roundUpToUnit(recommended, rule.roundingUnitToman);
  const paymentFeeToman = applyBps(estimatedToman, rule.paymentFeeBps);
  const marginToman = estimatedToman - preMarginToman - paymentFeeToman;

  const depositToman = depositAmount({
    total: estimatedToman,
    depositBps: rule.depositBps,
    minimumToman: rule.minDepositToman,
    roundingUnit: rule.roundingUnitToman,
  });

  return {
    sourceEurCents,
    effectiveTomanPerEur,
    sourceToman,
    transportToman,
    customsRiskToman,
    localDeliveryToman,
    preMarginToman,
    marginToman,
    paymentFeeToman,
    estimatedToman,
    depositToman,
    balanceToman: estimatedToman - depositToman,
  };
}

/**
 * Deterministic scenarios for the admin price simulator. The simulator is
 * deliberately built on the production calculator so it cannot drift into a
 * second pricing implementation.
 */
export function simulatePriceSensitivity(
  input: EstimateInput,
): readonly PriceSensitivityScenario[] {
  const scenarios = [
    { label: "current" as const, rateBps: 10_000 },
    { label: "fx-plus-5" as const, rateBps: 10_500 },
    { label: "fx-plus-10" as const, rateBps: 11_000 },
  ];
  return scenarios.map(({ label, rateBps }) => {
    const tomanPerEur = divideRoundHalfUp(
      input.tomanPerEur * BigInt(rateBps),
      BPS_DENOMINATOR,
    );
    return {
      label,
      tomanPerEur,
      breakdown: estimatePrice({ ...input, tomanPerEur }),
    };
  });
}

/**
 * Factual discount in basis points, or `null`.
 *
 * Only a genuine drop in the observed source price counts. FX movement must
 * never be marketed as a discount, so the comparison happens in EUR.
 */
export function sourceDiscountBps(
  currentEurCents: EurCents,
  previousEurCents: EurCents | null | undefined,
): number | null {
  if (previousEurCents == null) return null;
  if (previousEurCents <= currentEurCents) return null;
  const dropped = previousEurCents - currentEurCents;
  return Number(divideRoundHalfUp(dropped * BPS_DENOMINATOR, previousEurCents));
}
