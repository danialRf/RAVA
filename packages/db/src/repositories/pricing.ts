import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";

import { fxRates, pricingRules, quoteItems, quotes } from "../schema";
import type { Executor } from "./executor";

/**
 * Most recent FX snapshot that is still fresh enough for the caller.
 *
 * Returns `null` instead of an old rate: the pricing engine must be able to
 * refuse to quote rather than quietly price on stale data.
 */
export async function findFreshFxRate(
  executor: Executor,
  options: {
    readonly maxAgeSeconds: number;
    readonly baseCurrency?: string;
    readonly quoteCurrency?: string;
    readonly side?: "BUY" | "SELL";
    readonly now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const oldestAcceptable = new Date(
    now.getTime() - options.maxAgeSeconds * 1000,
  );

  const [rate] = await executor
    .select()
    .from(fxRates)
    .where(
      and(
        eq(fxRates.baseCurrency, options.baseCurrency ?? "EUR"),
        eq(fxRates.quoteCurrency, options.quoteCurrency ?? "TOMAN"),
        eq(fxRates.side, options.side ?? "SELL"),
        gte(fxRates.providerTimestamp, oldestAcceptable),
      ),
    )
    .orderBy(desc(fxRates.providerTimestamp))
    .limit(1);

  return rate ?? null;
}

/** Persists an FX observation. Snapshots are append-only and never updated. */
export async function recordFxRate(
  executor: Executor,
  snapshot: {
    readonly provider: string;
    readonly tomanPerUnit: bigint;
    readonly providerTimestamp: Date;
    readonly fetchedAt?: Date;
    readonly baseCurrency?: string;
    readonly quoteCurrency?: string;
    readonly side?: "BUY" | "SELL";
    readonly rawReference?: Record<string, unknown>;
  },
) {
  const [rate] = await executor
    .insert(fxRates)
    .values({
      provider: snapshot.provider,
      baseCurrency: snapshot.baseCurrency ?? "EUR",
      quoteCurrency: snapshot.quoteCurrency ?? "TOMAN",
      side: snapshot.side ?? "SELL",
      tomanPerUnit: snapshot.tomanPerUnit,
      providerTimestamp: snapshot.providerTimestamp,
      fetchedAt: snapshot.fetchedAt ?? new Date(),
      rawReference: snapshot.rawReference ?? {},
    })
    .returning();

  if (rate === undefined)
    throw new Error("FX rate insert did not return a row");
  return rate;
}

export interface PricingRuleQuery {
  readonly productId?: string | null;
  readonly brandId?: string | null;
  readonly categoryId?: string | null;
  readonly trustTier?: string | null;
  readonly sourcePriceEurCents?: bigint | null;
  readonly now?: Date;
}

export type PricingRule = typeof pricingRules.$inferSelect;

const RULE_SCOPE_ORDER: Readonly<Record<PricingRule["scope"], number>> = {
  PRODUCT: 1,
  BRAND: 2,
  CATEGORY: 3,
  PRICE_BAND: 4,
  TRUST_TIER: 5,
  GLOBAL: 6,
};

/** Loads the small active rule set once so a product list does not query per row. */
export async function listActivePricingRules(
  executor: Executor,
  now = new Date(),
): Promise<readonly PricingRule[]> {
  return executor
    .select()
    .from(pricingRules)
    .where(
      and(
        lte(pricingRules.activeFrom, now),
        or(isNull(pricingRules.activeTo), gt(pricingRules.activeTo, now)),
      ),
    )
    .orderBy(
      sql`case ${pricingRules.scope}
        when 'PRODUCT' then 1
        when 'BRAND' then 2
        when 'CATEGORY' then 3
        when 'PRICE_BAND' then 4
        when 'TRUST_TIER' then 5
        else 6 end`,
      desc(pricingRules.priority),
      desc(pricingRules.activeFrom),
    );
}

/** Pure equivalent of the SQL resolver for an already-loaded active rule set. */
export function selectPricingRule(
  rules: readonly PricingRule[],
  query: PricingRuleQuery,
): PricingRule | null {
  const matches = rules.filter((rule) => {
    switch (rule.scope) {
      case "PRODUCT":
        return query.productId != null && rule.productId === query.productId;
      case "BRAND":
        return query.brandId != null && rule.brandId === query.brandId;
      case "CATEGORY":
        return query.categoryId != null && rule.categoryId === query.categoryId;
      case "PRICE_BAND":
        return (
          query.sourcePriceEurCents != null &&
          (rule.priceBandMinEurCents == null ||
            rule.priceBandMinEurCents <= query.sourcePriceEurCents) &&
          (rule.priceBandMaxEurCents == null ||
            rule.priceBandMaxEurCents > query.sourcePriceEurCents)
        );
      case "TRUST_TIER":
        return query.trustTier != null && rule.trustTier === query.trustTier;
      case "GLOBAL":
        return true;
    }
  });

  return (
    matches.sort(
      (left, right) =>
        RULE_SCOPE_ORDER[left.scope] - RULE_SCOPE_ORDER[right.scope] ||
        right.priority - left.priority ||
        right.activeFrom.getTime() - left.activeFrom.getTime(),
    )[0] ?? null
  );
}

/**
 * Resolves the single rule that applies, most specific first.
 *
 * Specificity order matches docs/PRICING_ENGINE.md: product override, brand,
 * category, price band, source trust tier, then the global default. Within one
 * scope the highest `priority` wins.
 */
export async function resolvePricingRule(
  executor: Executor,
  query: PricingRuleQuery,
) {
  const now = query.now ?? new Date();

  const scopeMatches = or(
    and(
      eq(pricingRules.scope, "PRODUCT"),
      query.productId != null
        ? eq(pricingRules.productId, query.productId)
        : sql`false`,
    ),
    and(
      eq(pricingRules.scope, "BRAND"),
      query.brandId != null
        ? eq(pricingRules.brandId, query.brandId)
        : sql`false`,
    ),
    and(
      eq(pricingRules.scope, "CATEGORY"),
      query.categoryId != null
        ? eq(pricingRules.categoryId, query.categoryId)
        : sql`false`,
    ),
    and(
      eq(pricingRules.scope, "PRICE_BAND"),
      query.sourcePriceEurCents != null
        ? sql`(${pricingRules.priceBandMinEurCents} is null or ${pricingRules.priceBandMinEurCents} <= ${query.sourcePriceEurCents})
            and (${pricingRules.priceBandMaxEurCents} is null or ${pricingRules.priceBandMaxEurCents} > ${query.sourcePriceEurCents})`
        : sql`false`,
    ),
    and(
      eq(pricingRules.scope, "TRUST_TIER"),
      query.trustTier != null
        ? sql`${pricingRules.trustTier}::text = ${query.trustTier}`
        : sql`false`,
    ),
    eq(pricingRules.scope, "GLOBAL"),
  );

  const [rule] = await executor
    .select()
    .from(pricingRules)
    .where(
      and(
        scopeMatches,
        lte(pricingRules.activeFrom, now),
        or(isNull(pricingRules.activeTo), gt(pricingRules.activeTo, now)),
      ),
    )
    .orderBy(
      sql`case ${pricingRules.scope}
        when 'PRODUCT' then 1
        when 'BRAND' then 2
        when 'CATEGORY' then 3
        when 'PRICE_BAND' then 4
        when 'TRUST_TIER' then 5
        else 6 end`,
      desc(pricingRules.priority),
      desc(pricingRules.activeFrom),
    )
    .limit(1);

  return rule ?? null;
}

export async function getQuoteWithItems(executor: Executor, quoteId: string) {
  const [quote] = await executor
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (quote === undefined) return null;

  const items = await executor
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));

  return { quote, items };
}

/** An ACTIVE quote is only usable while it has not expired. */
export async function findUsableQuote(
  executor: Executor,
  quoteId: string,
  now = new Date(),
) {
  const [quote] = await executor
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.id, quoteId),
        eq(quotes.status, "ACTIVE"),
        gt(quotes.expiresAt, now),
      ),
    )
    .limit(1);

  return quote ?? null;
}

/** Marks lapsed quotes as EXPIRED. Returns how many rows changed. */
export async function expireStaleQuotes(
  executor: Executor,
  now = new Date(),
): Promise<number> {
  const expired = await executor
    .update(quotes)
    .set({ status: "EXPIRED" })
    .where(and(eq(quotes.status, "ACTIVE"), lte(quotes.expiresAt, now)))
    .returning({ id: quotes.id });

  return expired.length;
}
