import "server-only";

import { cache } from "react";

import { loadEnvironment } from "@rava/config";
import {
  estimatePrice,
  sourceDiscountBps,
  type EstimateBreakdown,
  type EstimateRule,
  type TransportClass,
} from "@rava/domain";
import {
  findFreshFxRate,
  listActivePricingRules,
  recordFxRate,
  selectPricingRule,
} from "@rava/db";
import {
  createFxRateProvider,
  FxRateUnavailableError,
} from "@rava/integrations";

import { database } from "./db";

/**
 * Browsing prices may use a cached rate. docs/PRICING_ENGINE.md allows 15
 * minutes here; checkout will demand a much fresher rate in Phase 5.
 */
const STOREFRONT_RATE_MAX_AGE_SECONDS = 15 * 60;

export interface StorefrontRate {
  readonly tomanPerEur: bigint;
  readonly observedAt: Date;
  readonly provider: string;
}

export interface CheckoutRate extends StorefrontRate {
  readonly id: string;
}

/** Checkout refuses rates older than five minutes. */
export async function getCheckoutRate(): Promise<CheckoutRate | null> {
  const db = database();
  const existing = await findFreshFxRate(db, { maxAgeSeconds: 5 * 60 });
  if (existing) {
    return {
      id: existing.id,
      tomanPerEur: existing.tomanPerUnit,
      observedAt: existing.providerTimestamp,
      provider: existing.provider,
    };
  }
  try {
    const environment = loadEnvironment();
    const snapshot = await createFxRateProvider(environment).getRate({
      base: "EUR",
      quote: "TOMAN",
      side: "SELL",
    });
    const stored = await recordFxRate(db, {
      provider: snapshot.sourceId,
      tomanPerUnit: snapshot.rate,
      providerTimestamp: snapshot.providerTimestamp,
      fetchedAt: snapshot.fetchedAt,
      rawReference: snapshot.rawReference,
    });
    return {
      id: stored.id,
      tomanPerEur: stored.tomanPerUnit,
      observedAt: stored.providerTimestamp,
      provider: stored.provider,
    };
  } catch (error) {
    if (error instanceof FxRateUnavailableError) return null;
    throw error;
  }
}

/**
 * Current FX snapshot for public estimates.
 *
 * Returns `null` when no fresh rate can be obtained. Callers must then render
 * the "price unavailable" state — never a stale or invented number.
 */
export const getStorefrontRate = cache(
  async (): Promise<StorefrontRate | null> => {
    const db = database();
    const existing = await findFreshFxRate(db, {
      maxAgeSeconds: STOREFRONT_RATE_MAX_AGE_SECONDS,
    });
    if (existing !== null) {
      return {
        tomanPerEur: existing.tomanPerUnit,
        observedAt: existing.providerTimestamp,
        provider: existing.provider,
      };
    }

    try {
      const environment = loadEnvironment();
      const provider = createFxRateProvider(environment);
      const snapshot = await provider.getRate({
        base: "EUR",
        quote: "TOMAN",
        side: "SELL",
      });
      const stored = await recordFxRate(db, {
        provider: snapshot.sourceId,
        tomanPerUnit: snapshot.rate,
        providerTimestamp: snapshot.providerTimestamp,
        fetchedAt: snapshot.fetchedAt,
        rawReference: snapshot.rawReference,
      });
      return {
        tomanPerEur: stored.tomanPerUnit,
        observedAt: stored.providerTimestamp,
        provider: stored.provider,
      };
    } catch (error) {
      if (error instanceof FxRateUnavailableError) return null;
      throw error;
    }
  },
);

/** One pricing-rule query per render, independent of product count. */
const getActiveRules = cache(async () => listActivePricingRules(database()));

export interface EstimateSubject {
  readonly productId: string;
  readonly brandId: string;
  readonly categoryId: string;
  readonly sourcePriceEurCents: bigint | null;
  readonly shippingEurCents: bigint | null;
  readonly previousPriceEurCents: bigint | null;
  readonly weightGrams: number | null;
  readonly transportClass: string | null;
  readonly categoryTransportClass: string | null;
}

export interface PriceEstimate {
  readonly ruleId: string;
  readonly estimatedToman: bigint;
  readonly depositToman: bigint;
  readonly discountBps: number | null;
  readonly rateObservedAt: Date;
  readonly breakdown: EstimateBreakdown;
}

const TRANSPORT_CLASSES: readonly TransportClass[] = [
  "XS",
  "S",
  "M",
  "L",
  "BLOCKED",
];

function transportClassOf(subject: EstimateSubject): TransportClass | null {
  const candidate = subject.transportClass ?? subject.categoryTransportClass;
  const match = TRANSPORT_CLASSES.find((value) => value === candidate);
  return match ?? null;
}

/**
 * Estimated Toman price for one offer, or `null` when we cannot price it
 * honestly: no offer, no rule, no rate, or a transport class we cannot carry.
 */
export async function estimateFor(
  subject: EstimateSubject,
  rate: StorefrontRate | null,
): Promise<PriceEstimate | null> {
  if (rate === null || subject.sourcePriceEurCents === null) return null;

  const rule = selectPricingRule(await getActiveRules(), {
    productId: subject.productId,
    brandId: subject.brandId,
    categoryId: subject.categoryId,
    sourcePriceEurCents: subject.sourcePriceEurCents,
  });
  if (rule === null) return null;

  // The product's own class wins over the category default; the rule class is
  // the last resort so a mis-scoped rule cannot silently change transport cost.
  const transportClass = transportClassOf(subject) ?? rule.transportClass;
  if (transportClass === "BLOCKED") return null;

  const estimateRule: EstimateRule = {
    targetMarginBps: rule.targetMarginBps,
    minProfitToman: rule.minProfitToman,
    customsRiskBps: rule.customsRiskBps,
    fxBufferBps: rule.fxBufferBps,
    paymentFeeBps: rule.paymentFeeBps,
    depositBps: rule.depositBps,
    minDepositToman: rule.minDepositToman,
    roundingUnitToman: rule.roundingUnitToman,
    transportClass,
  };

  const breakdown = estimatePrice({
    sourcePriceEurCents: subject.sourcePriceEurCents,
    shippingEurCents: subject.shippingEurCents ?? 0n,
    tomanPerEur: rate.tomanPerEur,
    rule: estimateRule,
    weightGrams: subject.weightGrams ?? undefined,
  });

  return {
    ruleId: rule.id,
    estimatedToman: breakdown.estimatedToman,
    depositToman: breakdown.depositToman,
    discountBps: sourceDiscountBps(
      subject.sourcePriceEurCents,
      subject.previousPriceEurCents,
    ),
    rateObservedAt: rate.observedAt,
    breakdown,
  };
}
