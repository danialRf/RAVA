/**
 * Storefront read model.
 *
 * The public pages need product, brand, category, best offer and image in one
 * shot. Every function here is written so a listing costs a fixed number of
 * queries regardless of how many products it returns — no N+1.
 */

import type { StockStatus, TrustTier } from "@rava/domain";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  brands,
  categories,
  contentEntries,
  productMedia,
  productVariants,
  products,
  retailers,
  sourceOffers,
  trips,
} from "../schema";
import type { Executor } from "./executor";

/** Sort options exposed by the listing UI. */
export const STOREFRONT_SORTS = [
  "recommended",
  "newest",
  "discount",
  "price-low",
  "price-high",
] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export interface StorefrontFilters {
  readonly categorySlug?: string | undefined;
  readonly brandSlug?: string | undefined;
  /** Only offers whose retailer/seller policy is satisfied. */
  readonly verifiedOnly?: boolean | undefined;
  /** Only products with an observed source price drop. */
  readonly discountOnly?: boolean | undefined;
  readonly search?: string | undefined;
  readonly sort?: StorefrontSort | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface StorefrontProductRow {
  readonly id: string;
  readonly slug: string;
  readonly titleFa: string;
  readonly titleOriginal: string;
  readonly weightGrams: number | null;
  readonly transportClass: string | null;
  readonly publishedAt: Date | null;
  readonly brandId: string;
  readonly brandName: string;
  readonly brandSlug: string;
  readonly categoryId: string;
  readonly categoryNameFa: string;
  readonly categorySlug: string;
  readonly categoryTransportClass: string | null;
  /** Null when no purchasable offer exists — the page must say so. */
  readonly offerId: string | null;
  readonly offerPriceEurCents: bigint | null;
  readonly offerShippingEurCents: bigint | null;
  readonly offerPreviousPriceEurCents: bigint | null;
  readonly offerStockStatus: StockStatus | null;
  readonly offerObservedAt: Date | null;
  readonly retailerName: string | null;
  readonly retailerTrustTier: TrustTier | null;
  readonly imageUrl: string | null;
  readonly imageAlt: string | null;
}

/**
 * Cheapest purchasable offer per product.
 *
 * Only verified, in-stock offers linked to an active variant qualify: an
 * unmatched or `UNKNOWN`-stock offer is not something we can sell.
 */
function bestOfferSubquery(executor: Executor) {
  return executor
    .select({
      productId: productVariants.productId,
      offerId: sourceOffers.id,
      priceEurCents: sourceOffers.sourcePriceEurCents,
      shippingEurCents: sourceOffers.shippingEurCents,
      previousPriceEurCents: sourceOffers.previousPriceEurCents,
      stockStatus: sourceOffers.stockStatus,
      observedAt: sourceOffers.lastSeenAt,
      retailerName: retailers.name,
      retailerTrustTier: retailers.trustTier,
      totalEurCents:
        sql<bigint>`${sourceOffers.sourcePriceEurCents} + coalesce(${sourceOffers.shippingEurCents}, 0)`.as(
          "total_eur_cents",
        ),
      rank: sql<number>`row_number() over (
        partition by ${productVariants.productId}
        order by ${sourceOffers.sourcePriceEurCents} + coalesce(${sourceOffers.shippingEurCents}, 0) asc,
                 ${sourceOffers.lastSeenAt} desc
      )`.as("offer_rank"),
    })
    .from(sourceOffers)
    .innerJoin(
      productVariants,
      eq(productVariants.id, sourceOffers.productVariantId),
    )
    .innerJoin(retailers, eq(retailers.id, sourceOffers.retailerId))
    .where(
      and(
        eq(sourceOffers.sourceVerified, true),
        eq(productVariants.status, "ACTIVE"),
        eq(retailers.isEnabled, true),
        inArray(sourceOffers.stockStatus, ["IN_STOCK", "LOW_STOCK"]),
      ),
    )
    .as("best_offer");
}

/** Primary image per product, one row each. */
function primaryMediaSubquery(executor: Executor) {
  return executor
    .select({
      productId: productMedia.productId,
      url: sql<string>`coalesce(${productMedia.storageKey}, ${productMedia.sourceUrl})`.as(
        "media_url",
      ),
      altTextFa: productMedia.altTextFa,
      rank: sql<number>`row_number() over (
        partition by ${productMedia.productId}
        order by case when ${productMedia.kind} = 'PRIMARY' then 0 else 1 end,
                 ${productMedia.sortOrder} asc
      )`.as("media_rank"),
    })
    .from(productMedia)
    .as("primary_media");
}

function searchCondition(term: string): SQL | undefined {
  const trimmed = term.trim();
  if (trimmed === "") return undefined;
  const pattern = `%${trimmed}%`;
  // Shoppers type brand and model names in Persian or Latin, so both the
  // Persian title and the original title are matched.
  return or(
    sql`${products.titleFa} ilike ${pattern}`,
    sql`${products.titleOriginal} ilike ${pattern}`,
    sql`${brands.name} ilike ${pattern}`,
    sql`${products.descriptionFa} ilike ${pattern}`,
  );
}

/**
 * One listing query returning products with their best offer and image.
 *
 * Price sorting uses the observed source price in EUR: under a single FX
 * snapshot the Toman order is identical, and the UI always states the rate
 * basis next to the sort control.
 */
export async function listStorefrontProducts(
  executor: Executor,
  filters: StorefrontFilters = {},
): Promise<readonly StorefrontProductRow[]> {
  const offer = bestOfferSubquery(executor);
  const media = primaryMediaSubquery(executor);

  const conditions: SQL[] = [eq(products.status, "PUBLISHED")];
  if (filters.categorySlug !== undefined) {
    conditions.push(eq(categories.slug, filters.categorySlug));
  }
  if (filters.brandSlug !== undefined) {
    conditions.push(eq(brands.slug, filters.brandSlug));
  }
  if (filters.verifiedOnly === true) {
    conditions.push(sql`${offer.offerId} is not null`);
  }
  if (filters.discountOnly === true) {
    conditions.push(
      sql`${offer.previousPriceEurCents} is not null and ${offer.previousPriceEurCents} > ${offer.priceEurCents}`,
    );
  }
  const search =
    filters.search === undefined ? undefined : searchCondition(filters.search);
  if (search !== undefined) conditions.push(search);

  const discountExpression = sql`case
    when ${offer.previousPriceEurCents} is null then 0
    when ${offer.previousPriceEurCents} <= ${offer.priceEurCents} then 0
    else (${offer.previousPriceEurCents} - ${offer.priceEurCents})::numeric / ${offer.previousPriceEurCents}
  end`;

  const orderBy = (() => {
    switch (filters.sort ?? "recommended") {
      case "newest":
        return [desc(products.publishedAt)];
      case "discount":
        return [desc(discountExpression), desc(products.publishedAt)];
      case "price-low":
        return [asc(offer.totalEurCents), asc(products.titleFa)];
      case "price-high":
        return [desc(offer.totalEurCents), asc(products.titleFa)];
      case "recommended":
      default:
        // In-stock offers first, then the freshest catalog entries.
        return [
          sql`case when ${offer.offerId} is null then 1 else 0 end`,
          desc(products.publishedAt),
        ];
    }
  })();

  return executor
    .select({
      id: products.id,
      slug: products.slug,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      weightGrams: products.weightGrams,
      transportClass: products.transportClass,
      publishedAt: products.publishedAt,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: categories.id,
      categoryNameFa: categories.nameFa,
      categorySlug: categories.slug,
      categoryTransportClass: categories.defaultTransportClass,
      offerId: offer.offerId,
      offerPriceEurCents: offer.priceEurCents,
      offerShippingEurCents: offer.shippingEurCents,
      offerPreviousPriceEurCents: offer.previousPriceEurCents,
      offerStockStatus: offer.stockStatus,
      offerObservedAt: offer.observedAt,
      retailerName: offer.retailerName,
      retailerTrustTier: offer.retailerTrustTier,
      imageUrl: media.url,
      imageAlt: media.altTextFa,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(offer, and(eq(offer.productId, products.id), eq(offer.rank, 1)))
    .leftJoin(media, and(eq(media.productId, products.id), eq(media.rank, 1)))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(filters.limit ?? 24)
    .offset(filters.offset ?? 0) as Promise<readonly StorefrontProductRow[]>;
}

/** Total matching products, for result counts and pagination. */
export async function countStorefrontProducts(
  executor: Executor,
  filters: StorefrontFilters = {},
): Promise<number> {
  const offer = bestOfferSubquery(executor);

  const conditions: SQL[] = [eq(products.status, "PUBLISHED")];
  if (filters.categorySlug !== undefined) {
    conditions.push(eq(categories.slug, filters.categorySlug));
  }
  if (filters.brandSlug !== undefined) {
    conditions.push(eq(brands.slug, filters.brandSlug));
  }
  if (filters.verifiedOnly === true) {
    conditions.push(sql`${offer.offerId} is not null`);
  }
  if (filters.discountOnly === true) {
    conditions.push(
      sql`${offer.previousPriceEurCents} is not null and ${offer.previousPriceEurCents} > ${offer.priceEurCents}`,
    );
  }
  const search =
    filters.search === undefined ? undefined : searchCondition(filters.search);
  if (search !== undefined) conditions.push(search);

  const [row] = await executor
    .select({ value: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(offer, and(eq(offer.productId, products.id), eq(offer.rank, 1)))
    .where(and(...conditions));

  return row?.value ?? 0;
}

export interface StorefrontVariantRow {
  readonly id: string;
  readonly skuInternal: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly volumeMl: number | null;
  readonly weightGramsOverride: number | null;
  readonly offerId: string | null;
  readonly offerPriceEurCents: bigint | null;
  readonly offerShippingEurCents: bigint | null;
  readonly offerPreviousPriceEurCents: bigint | null;
  readonly offerStockStatus: StockStatus | null;
  readonly offerObservedAt: Date | null;
  readonly offerSourceUrl: string | null;
  readonly retailerName: string | null;
  readonly retailerTrustTier: TrustTier | null;
}

/**
 * Full product detail: the product row, its variants with each variant's best
 * offer, and its media. Three queries, independent of variant count.
 */
export async function getStorefrontProduct(executor: Executor, slug: string) {
  const [product] = await executor
    .select({
      id: products.id,
      slug: products.slug,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      descriptionFa: products.descriptionFa,
      weightGrams: products.weightGrams,
      transportClass: products.transportClass,
      publishedAt: products.publishedAt,
      seoTitle: products.seoTitle,
      seoDescription: products.seoDescription,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: categories.id,
      categoryNameFa: categories.nameFa,
      categorySlug: categories.slug,
      categoryTransportClass: categories.defaultTransportClass,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.status, "PUBLISHED")))
    .limit(1);

  if (product === undefined) return null;

  const [variants, media] = await Promise.all([
    executor
      .select({
        id: productVariants.id,
        skuInternal: productVariants.skuInternal,
        size: productVariants.size,
        color: productVariants.color,
        volumeMl: productVariants.volumeMl,
        weightGramsOverride: productVariants.weightGramsOverride,
        offerId: sourceOffers.id,
        offerPriceEurCents: sourceOffers.sourcePriceEurCents,
        offerShippingEurCents: sourceOffers.shippingEurCents,
        offerPreviousPriceEurCents: sourceOffers.previousPriceEurCents,
        offerStockStatus: sourceOffers.stockStatus,
        offerObservedAt: sourceOffers.lastSeenAt,
        offerSourceUrl: sourceOffers.sourceUrl,
        retailerName: retailers.name,
        retailerTrustTier: retailers.trustTier,
      })
      .from(productVariants)
      // A variant without a usable offer still renders, marked unavailable.
      .leftJoin(
        sourceOffers,
        and(
          eq(sourceOffers.productVariantId, productVariants.id),
          eq(sourceOffers.sourceVerified, true),
          inArray(sourceOffers.stockStatus, ["IN_STOCK", "LOW_STOCK"]),
        ),
      )
      .leftJoin(retailers, eq(retailers.id, sourceOffers.retailerId))
      .where(
        and(
          eq(productVariants.productId, product.id),
          eq(productVariants.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(productVariants.skuInternal)),
    executor
      .select({
        id: productMedia.id,
        url: sql<string>`coalesce(${productMedia.storageKey}, ${productMedia.sourceUrl})`,
        altTextFa: productMedia.altTextFa,
        kind: productMedia.kind,
        sourceAttribution: productMedia.sourceAttribution,
      })
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.sortOrder)),
  ]);

  return { product, variants: variants as StorefrontVariantRow[], media };
}

/** Enabled categories with how many published products each holds. */
export async function listCategoriesWithCounts(executor: Executor) {
  return executor
    .select({
      id: categories.id,
      nameFa: categories.nameFa,
      nameEn: categories.nameEn,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(
        eq(products.categoryId, categories.id),
        eq(products.status, "PUBLISHED"),
      ),
    )
    .where(eq(categories.isEnabled, true))
    .groupBy(
      categories.id,
      categories.nameFa,
      categories.nameEn,
      categories.slug,
      categories.sortOrder,
    )
    .orderBy(asc(categories.sortOrder), asc(categories.nameFa));
}

/** Active brands that actually have published products. */
export async function listBrandsWithCounts(executor: Executor, limit = 12) {
  return executor
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      country: brands.country,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(brands)
    .innerJoin(
      products,
      and(eq(products.brandId, brands.id), eq(products.status, "PUBLISHED")),
    )
    .where(eq(brands.isActive, true))
    .groupBy(brands.id, brands.name, brands.slug, brands.country)
    .orderBy(desc(sql`count(${products.id})`), asc(brands.name))
    .limit(limit);
}

/**
 * Published content entries by key, newest version first.
 *
 * The storefront reads its editorial copy through this so the admin can own it
 * later without the pages changing.
 */
export async function listPublishedContent(
  executor: Executor,
  keys: readonly string[],
  locale = "fa-IR",
) {
  if (keys.length === 0) return [];
  return executor
    .select({
      key: contentEntries.key,
      title: contentEntries.title,
      body: contentEntries.body,
      version: contentEntries.version,
      publishedAt: contentEntries.publishedAt,
    })
    .from(contentEntries)
    .where(
      and(
        inArray(contentEntries.key, [...keys]),
        eq(contentEntries.locale, locale),
        eq(contentEntries.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(contentEntries.key), desc(contentEntries.version));
}

/**
 * Products by slug in the caller's order.
 *
 * Wishlist and recently-viewed lists are slug lists, so this resolves them in
 * a single query instead of one lookup per entry.
 */
export async function listStorefrontProductsBySlugs(
  executor: Executor,
  slugs: readonly string[],
): Promise<readonly StorefrontProductRow[]> {
  if (slugs.length === 0) return [];
  const offer = bestOfferSubquery(executor);
  const media = primaryMediaSubquery(executor);

  const rows = (await executor
    .select({
      id: products.id,
      slug: products.slug,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      weightGrams: products.weightGrams,
      transportClass: products.transportClass,
      publishedAt: products.publishedAt,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryId: categories.id,
      categoryNameFa: categories.nameFa,
      categorySlug: categories.slug,
      categoryTransportClass: categories.defaultTransportClass,
      offerId: offer.offerId,
      offerPriceEurCents: offer.priceEurCents,
      offerShippingEurCents: offer.shippingEurCents,
      offerPreviousPriceEurCents: offer.previousPriceEurCents,
      offerStockStatus: offer.stockStatus,
      offerObservedAt: offer.observedAt,
      retailerName: offer.retailerName,
      retailerTrustTier: offer.retailerTrustTier,
      imageUrl: media.url,
      imageAlt: media.altTextFa,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(offer, and(eq(offer.productId, products.id), eq(offer.rank, 1)))
    .leftJoin(media, and(eq(media.productId, products.id), eq(media.rank, 1)))
    .where(
      and(eq(products.status, "PUBLISHED"), inArray(products.slug, [...slugs])),
    )) as readonly StorefrontProductRow[];

  const order = new Map(slugs.map((slug, index) => [slug, index]));
  return [...rows].sort(
    (left, right) => (order.get(left.slug) ?? 0) - (order.get(right.slug) ?? 0),
  );
}

/** The next trip customers can still join, for the announcement strip. */
export async function findNextOpenTrip(executor: Executor, now = new Date()) {
  const [trip] = await executor
    .select()
    .from(trips)
    .where(
      and(
        inArray(trips.status, ["PLANNED", "COLLECTING"]),
        or(
          sql`${trips.departureWindowStart} is null`,
          gt(trips.departureWindowStart, now),
        ),
      ),
    )
    .orderBy(asc(trips.departureWindowStart))
    .limit(1);
  return trip ?? null;
}
