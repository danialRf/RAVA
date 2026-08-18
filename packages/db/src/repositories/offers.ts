import type { StockStatus } from "@rava/domain";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { offerPriceHistory, sourceOffers } from "../schema";
import type { Executor } from "./executor";

export interface OfferObservation {
  readonly retailerId: string;
  readonly sellerId?: string | null;
  readonly externalOfferId?: string | null;
  readonly sourceUrl: string;
  readonly rawTitle: string;
  readonly sourcePriceEurCents: bigint;
  readonly previousPriceEurCents?: bigint | null;
  readonly shippingEurCents?: bigint | null;
  readonly stockStatus: StockStatus;
  readonly stockQuantity?: number | null;
  readonly sourceIdentifiers?: Record<string, string>;
  readonly sourceImageUrls?: readonly string[];
  readonly sourceVerified?: boolean;
  readonly observedAt?: Date;
}

/**
 * Records one scraped observation.
 *
 * The offer row holds the current state and `offer_price_history` receives an
 * append-only entry whenever price, shipping or stock actually changed. An
 * unchanged observation only moves `last_seen_at`, so history stays honest and
 * does not inflate into a row per crawl.
 */
export async function recordOfferObservation(
  executor: Executor,
  observation: OfferObservation,
): Promise<{ readonly offerId: string; readonly historyAppended: boolean }> {
  const observedAt = observation.observedAt ?? new Date();

  const [offer] = await executor
    .insert(sourceOffers)
    .values({
      retailerId: observation.retailerId,
      sellerId: observation.sellerId ?? null,
      externalOfferId: observation.externalOfferId ?? null,
      sourceUrl: observation.sourceUrl,
      rawTitle: observation.rawTitle,
      sourcePriceEurCents: observation.sourcePriceEurCents,
      previousPriceEurCents: observation.previousPriceEurCents ?? null,
      shippingEurCents: observation.shippingEurCents ?? null,
      stockStatus: observation.stockStatus,
      stockQuantity: observation.stockQuantity ?? null,
      sourceIdentifiers: observation.sourceIdentifiers ?? {},
      sourceImageUrls: observation.sourceImageUrls ?? [],
      sourceVerified: observation.sourceVerified ?? false,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
    })
    .onConflictDoUpdate({
      target: [sourceOffers.retailerId, sourceOffers.sourceUrl],
      set: {
        rawTitle: observation.rawTitle,
        // The prior current price becomes the previous price on every change.
        previousPriceEurCents: sql`case
          when ${sourceOffers.sourcePriceEurCents} <> ${observation.sourcePriceEurCents}
          then ${sourceOffers.sourcePriceEurCents}
          else ${sourceOffers.previousPriceEurCents} end`,
        sourcePriceEurCents: observation.sourcePriceEurCents,
        shippingEurCents: observation.shippingEurCents ?? null,
        stockStatus: observation.stockStatus,
        stockQuantity: observation.stockQuantity ?? null,
        sourceVerified: observation.sourceVerified ?? false,
        lastSeenAt: observedAt,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: sourceOffers.id,
      priceEurCents: sourceOffers.sourcePriceEurCents,
    });

  if (offer === undefined) {
    throw new Error("Offer upsert did not return a row");
  }

  const [latest] = await executor
    .select({
      priceEurCents: offerPriceHistory.priceEurCents,
      shippingEurCents: offerPriceHistory.shippingEurCents,
      stockStatus: offerPriceHistory.stockStatus,
    })
    .from(offerPriceHistory)
    .where(eq(offerPriceHistory.offerId, offer.id))
    .orderBy(desc(offerPriceHistory.observedAt))
    .limit(1);

  const shipping = observation.shippingEurCents ?? null;
  const unchanged =
    latest !== undefined &&
    latest.priceEurCents === observation.sourcePriceEurCents &&
    latest.shippingEurCents === shipping &&
    latest.stockStatus === observation.stockStatus;

  if (unchanged) {
    return { offerId: offer.id, historyAppended: false };
  }

  await executor.insert(offerPriceHistory).values({
    offerId: offer.id,
    priceEurCents: observation.sourcePriceEurCents,
    shippingEurCents: shipping,
    stockStatus: observation.stockStatus,
    observedAt,
  });

  return { offerId: offer.id, historyAppended: true };
}

/** Offers linked to a variant, cheapest first. Unmatched offers are excluded. */
export async function listOffersForVariant(
  executor: Executor,
  variantId: string,
) {
  return executor
    .select()
    .from(sourceOffers)
    .where(eq(sourceOffers.productVariantId, variantId))
    .orderBy(asc(sourceOffers.sourcePriceEurCents));
}

/**
 * Cheapest purchasable offer for a variant.
 *
 * Only verified, in-stock offers qualify: `UNKNOWN` stock is never treated as
 * available, and an unverified source may not back a customer price.
 */
export async function findBestOfferForVariant(
  executor: Executor,
  variantId: string,
) {
  const [offer] = await executor
    .select()
    .from(sourceOffers)
    .where(
      and(
        eq(sourceOffers.productVariantId, variantId),
        eq(sourceOffers.sourceVerified, true),
        sql`${sourceOffers.stockStatus} in ('IN_STOCK', 'LOW_STOCK')`,
      ),
    )
    .orderBy(
      asc(
        sql`${sourceOffers.sourcePriceEurCents} + coalesce(${sourceOffers.shippingEurCents}, 0)`,
      ),
    )
    .limit(1);

  return offer ?? null;
}

/** Observation history for one offer, oldest first. */
export async function listOfferPriceHistory(
  executor: Executor,
  offerId: string,
  limit = 100,
) {
  return executor
    .select()
    .from(offerPriceHistory)
    .where(eq(offerPriceHistory.offerId, offerId))
    .orderBy(asc(offerPriceHistory.observedAt))
    .limit(limit);
}
