import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  brands,
  categories,
  productMedia,
  productVariants,
  products,
} from "../schema";
import type { Executor } from "./executor";

export interface ProductListItem {
  readonly id: string;
  readonly slug: string;
  readonly titleFa: string;
  readonly titleOriginal: string;
  readonly brandName: string;
  readonly categorySlug: string;
}

const publishedOnly = eq(products.status, "PUBLISHED");

/** Published products for listing pages. Never returns drafts. */
export async function listPublishedProducts(
  executor: Executor,
  options: { readonly categorySlug?: string; readonly limit?: number } = {},
): Promise<readonly ProductListItem[]> {
  const filters = [publishedOnly];
  if (options.categorySlug !== undefined) {
    filters.push(eq(categories.slug, options.categorySlug));
  }

  return executor
    .select({
      id: products.id,
      slug: products.slug,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      brandName: brands.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...filters))
    .orderBy(desc(products.publishedAt))
    .limit(options.limit ?? 24);
}

/**
 * Full product detail for a public page.
 *
 * Returns `null` rather than throwing so callers can render a 404; a draft
 * product is treated as absent for the storefront.
 */
export async function getPublishedProductBySlug(
  executor: Executor,
  slug: string,
) {
  const [product] = await executor
    .select({
      product: products,
      brand: brands,
      category: categories,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), publishedOnly))
    .limit(1);

  if (product === undefined) return null;

  const [variants, media] = await Promise.all([
    executor
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, product.product.id),
          eq(productVariants.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(productVariants.skuInternal)),
    executor
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, product.product.id))
      .orderBy(asc(productMedia.sortOrder)),
  ]);

  return { ...product, variants, media };
}

/**
 * Persian/Latin catalog search.
 *
 * Matches both the Persian title and the original (Latin) title because
 * shoppers type brand and model names in either script.
 */
export async function searchPublishedProducts(
  executor: Executor,
  term: string,
  limit = 24,
): Promise<readonly ProductListItem[]> {
  const trimmed = term.trim();
  if (trimmed === "") return [];
  const pattern = `%${trimmed}%`;

  return executor
    .select({
      id: products.id,
      slug: products.slug,
      titleFa: products.titleFa,
      titleOriginal: products.titleOriginal,
      brandName: brands.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        publishedOnly,
        or(
          ilike(products.titleFa, pattern),
          ilike(products.titleOriginal, pattern),
          ilike(brands.name, pattern),
        ),
      ),
    )
    .orderBy(sql`length(${products.titleFa})`)
    .limit(limit);
}

/** Direct-children lookup used by the category navigation. */
export async function listCategoryChildren(
  executor: Executor,
  parentSlug: string | null,
) {
  const parentFilter =
    parentSlug === null
      ? sql`${categories.parentId} is null`
      : sql`${categories.parentId} = (select id from ${categories} where slug = ${parentSlug})`;

  return executor
    .select()
    .from(categories)
    .where(and(eq(categories.isEnabled, true), parentFilter))
    .orderBy(asc(categories.sortOrder), asc(categories.nameFa));
}
