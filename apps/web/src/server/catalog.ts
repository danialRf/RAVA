import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import {
  countStorefrontProducts,
  findNextOpenTrip,
  getStorefrontProduct,
  listBrandsWithCounts,
  listCategoriesWithCounts,
  listPublishedContent,
  listStorefrontProducts,
  listStorefrontProductsBySlugs,
  type StorefrontFilters,
  type StorefrontProductRow,
} from "@rava/db";
import type { StockStatus, TrustTier } from "@rava/domain";

import { formatCount, toPersianDigits } from "../lib/format";
import { database } from "./db";
import { estimateFor, getStorefrontRate, type PriceEstimate } from "./pricing";

/**
 * What a product card needs.
 *
 * `estimate` is null whenever the price cannot be stated honestly, and the UI
 * renders an explicit unavailable state instead of a number.
 */
export interface ProductCardModel {
  readonly id: string;
  readonly slug: string;
  readonly titleFa: string;
  readonly titleOriginal: string;
  readonly brandName: string;
  readonly brandSlug: string;
  readonly categoryNameFa: string;
  readonly categorySlug: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly retailerName: string | null;
  readonly trustTier: TrustTier | null;
  readonly stockStatus: StockStatus | null;
  readonly observedAt: Date | null;
  readonly estimate: PriceEstimate | null;
}

const FALLBACK_IMAGE = "/products/bag.svg";

const cachedCategories = unstable_cache(
  async () => listCategoriesWithCounts(database()),
  ["storefront-categories-v1"],
  { revalidate: 300, tags: ["storefront-taxonomy"] },
);
const cachedBrands = unstable_cache(
  async (limit: number) => listBrandsWithCounts(database(), limit),
  ["storefront-brands-v1"],
  { revalidate: 300, tags: ["storefront-taxonomy"] },
);

async function toCardModel(
  row: StorefrontProductRow,
  rate: Awaited<ReturnType<typeof getStorefrontRate>>,
): Promise<ProductCardModel> {
  const estimate = await estimateFor(
    {
      productId: row.id,
      brandId: row.brandId,
      categoryId: row.categoryId,
      sourcePriceEurCents: row.offerPriceEurCents,
      shippingEurCents: row.offerShippingEurCents,
      previousPriceEurCents: row.offerPreviousPriceEurCents,
      weightGrams: row.weightGrams,
      transportClass: row.transportClass,
      categoryTransportClass: row.categoryTransportClass,
    },
    rate,
  );

  return {
    id: row.id,
    slug: row.slug,
    titleFa: row.titleFa,
    titleOriginal: row.titleOriginal,
    brandName: row.brandName,
    brandSlug: row.brandSlug,
    categoryNameFa: row.categoryNameFa,
    categorySlug: row.categorySlug,
    imageUrl: row.imageUrl ?? FALLBACK_IMAGE,
    imageAlt: row.imageAlt ?? row.titleFa,
    retailerName: row.retailerName,
    trustTier: row.retailerTrustTier,
    stockStatus: row.offerStockStatus,
    observedAt: row.offerObservedAt,
    estimate,
  };
}

async function toCardModels(
  rows: readonly StorefrontProductRow[],
): Promise<readonly ProductCardModel[]> {
  const rate = await getStorefrontRate();
  return Promise.all(rows.map((row) => toCardModel(row, rate)));
}

export const listProducts = cache(
  async (
    filters: StorefrontFilters = {},
  ): Promise<readonly ProductCardModel[]> =>
    toCardModels(await listStorefrontProducts(database(), filters)),
);

export const countProducts = cache(
  async (filters: StorefrontFilters = {}): Promise<number> =>
    countStorefrontProducts(database(), filters),
);

export const listProductsBySlugs = cache(
  async (slugs: readonly string[]): Promise<readonly ProductCardModel[]> =>
    toCardModels(await listStorefrontProductsBySlugs(database(), slugs)),
);

export const listCategories = cache(async () => cachedCategories());

export const listBrands = cache(async (limit = 8) => cachedBrands(limit));

export const nextTrip = cache(async () => findNextOpenTrip(database()));

export interface VariantModel {
  readonly id: string;
  readonly sourceOfferId: string | null;
  readonly skuInternal: string;
  readonly label: string;
  readonly available: boolean;
  readonly stockStatus: StockStatus | null;
  readonly retailerName: string | null;
  readonly trustTier: TrustTier | null;
  readonly observedAt: Date | null;
  readonly estimate: PriceEstimate | null;
}

export interface ProductDetailModel {
  readonly id: string;
  readonly slug: string;
  readonly titleFa: string;
  readonly titleOriginal: string;
  readonly descriptionFa: string | null;
  readonly brandName: string;
  readonly brandSlug: string;
  readonly categoryNameFa: string;
  readonly categorySlug: string;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly images: readonly {
    readonly url: string;
    readonly alt: string;
    readonly attribution: string | null;
  }[];
  readonly variants: readonly VariantModel[];
  /** Cheapest available variant, or null when nothing is purchasable. */
  readonly leadVariant: VariantModel | null;
}

/**
 * Human label for a variant, built only from stored attributes.
 *
 * Retailer sizes and volumes arrive in Latin digits; they are rendered in
 * Persian digits because that is what the customer reads everywhere else.
 */
function variantLabel(variant: {
  readonly size: string | null;
  readonly color: string | null;
  readonly volumeMl: number | null;
  readonly skuInternal: string;
}): string {
  const parts: string[] = [];
  if (variant.size !== null) {
    parts.push(`سایز ${toPersianDigits(variant.size)}`);
  }
  if (variant.color !== null) parts.push(variant.color);
  if (variant.volumeMl !== null) {
    parts.push(`${formatCount(variant.volumeMl)} میلی‌لیتر`);
  }
  return parts.length > 0 ? parts.join(" · ") : variant.skuInternal;
}

export const getProductDetail = cache(
  async (slug: string): Promise<ProductDetailModel | null> => {
    const result = await getStorefrontProduct(database(), slug);
    if (result === null) return null;

    const rate = await getStorefrontRate();
    const { product, variants, media } = result;

    const variantModels = await Promise.all(
      variants.map(async (variant): Promise<VariantModel> => {
        const estimate = await estimateFor(
          {
            productId: product.id,
            brandId: product.brandId,
            categoryId: product.categoryId,
            sourcePriceEurCents: variant.offerPriceEurCents,
            shippingEurCents: variant.offerShippingEurCents,
            previousPriceEurCents: variant.offerPreviousPriceEurCents,
            weightGrams: variant.weightGramsOverride ?? product.weightGrams,
            transportClass: product.transportClass,
            categoryTransportClass: product.categoryTransportClass,
          },
          rate,
        );

        return {
          id: variant.id,
          sourceOfferId: variant.offerId,
          skuInternal: variant.skuInternal,
          label: variantLabel(variant),
          available: variant.offerId !== null,
          stockStatus: variant.offerStockStatus,
          retailerName: variant.retailerName,
          trustTier: variant.retailerTrustTier,
          observedAt: variant.offerObservedAt,
          estimate,
        };
      }),
    );

    const purchasable = variantModels.filter(
      (variant) => variant.available && variant.estimate !== null,
    );
    const leadVariant =
      purchasable.reduce<VariantModel | null>((cheapest, variant) => {
        if (cheapest?.estimate == null) return variant;
        return variant.estimate!.estimatedToman <
          cheapest.estimate.estimatedToman
          ? variant
          : cheapest;
      }, null) ?? null;

    return {
      id: product.id,
      slug: product.slug,
      titleFa: product.titleFa,
      titleOriginal: product.titleOriginal,
      descriptionFa: product.descriptionFa,
      brandName: product.brandName,
      brandSlug: product.brandSlug,
      categoryNameFa: product.categoryNameFa,
      categorySlug: product.categorySlug,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      images:
        media.length > 0
          ? media.map((item) => ({
              url: item.url,
              alt: item.altTextFa ?? product.titleFa,
              attribution: item.sourceAttribution,
            }))
          : [
              {
                url: FALLBACK_IMAGE,
                alt: product.titleFa,
                attribution: null,
              },
            ],
      variants: variantModels,
      leadVariant,
    };
  },
);

export interface HomeContent {
  readonly title: string;
  readonly body: Record<string, unknown>;
}

/**
 * Editorial copy from `content_entries`, with a built-in fallback.
 *
 * The fallback keeps the page renderable before an admin exists; it is layout
 * copy only and states no product, price or source fact.
 */
export const getContent = cache(
  async (keys: readonly string[]): Promise<Map<string, HomeContent>> => {
    const rows = await listPublishedContent(database(), keys);
    const map = new Map<string, HomeContent>();
    for (const row of rows) {
      // Rows arrive newest-version-first, so the first one per key wins.
      if (map.has(row.key)) continue;
      map.set(row.key, { title: row.title ?? "", body: row.body });
    }
    return map;
  },
);
