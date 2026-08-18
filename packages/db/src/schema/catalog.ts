import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, moment, primaryId, updatedAt } from "./columns";
import {
  mediaKindEnum,
  productStatusEnum,
  transportClassEnum,
  variantStatusEnum,
} from "./enums";

export const brands = pgTable(
  "brands",
  {
    id: primaryId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    country: text("country"),
    logoMediaId: uuid("logo_media_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("brands_slug_unique").on(table.slug),
    index("brands_active_idx").on(table.isActive),
  ],
);

/**
 * Hierarchical catalog category.
 *
 * `requiresManualReview` and `maxWeightGrams` are policy gates: regulated or
 * heavy categories must never be auto-published or auto-priced.
 */
export const categories = pgTable(
  "categories",
  {
    id: primaryId(),
    parentId: uuid("parent_id"),
    nameFa: text("name_fa").notNull(),
    nameEn: text("name_en").notNull(),
    slug: text("slug").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    requiresManualReview: boolean("requires_manual_review")
      .notNull()
      .default(false),
    maxWeightGrams: integer("max_weight_grams"),
    defaultTransportClass: transportClassEnum("default_transport_class"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_idx").on(table.parentId, table.sortOrder),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "categories_parent_fk",
    }).onDelete("restrict"),
    check("categories_not_self_parent", sql`${table.parentId} <> ${table.id}`),
    check(
      "categories_max_weight_positive",
      sql`${table.maxWeightGrams} is null or ${table.maxWeightGrams} > 0`,
    ),
  ],
);

/** Canonical product. One product may be sold by many retailers. */
export const products = pgTable(
  "products",
  {
    id: primaryId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    titleFa: text("title_fa").notNull(),
    titleOriginal: text("title_original").notNull(),
    slug: text("slug").notNull(),
    descriptionFa: text("description_fa"),
    status: productStatusEnum("status").notNull().default("DRAFT"),
    weightGrams: integer("weight_grams"),
    dimensionsMm: jsonb("dimensions_mm").$type<{
      length: number;
      width: number;
      height: number;
    }>(),
    transportClass: transportClassEnum("transport_class"),
    productType: text("product_type"),
    /** GTIN/EAN/UPC/MPN observed for the canonical product, never invented. */
    canonicalIdentifiers: jsonb("canonical_identifiers")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: moment("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_brand_category_idx").on(table.brandId, table.categoryId),
    index("products_status_idx").on(table.status),
    check(
      "products_weight_positive",
      sql`${table.weightGrams} is null or ${table.weightGrams} > 0`,
    ),
    check(
      "products_published_has_timestamp",
      sql`${table.status} <> 'PUBLISHED' or ${table.publishedAt} is not null`,
    ),
  ],
);

/** A purchasable configuration of a product (size, colour, volume …). */
export const productVariants = pgTable(
  "product_variants",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    skuInternal: text("sku_internal").notNull(),
    gtin: text("gtin"),
    manufacturerSku: text("manufacturer_sku"),
    size: text("size"),
    color: text("color"),
    volumeMl: integer("volume_ml"),
    genderUse: text("gender_use"),
    attributes: jsonb("attributes")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    weightGramsOverride: integer("weight_grams_override"),
    status: variantStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("product_variants_sku_unique").on(table.skuInternal),
    index("product_variants_product_idx").on(table.productId, table.status),
    uniqueIndex("product_variants_gtin_unique")
      .on(table.gtin)
      .where(sql`${table.gtin} is not null`),
    check(
      "product_variants_gtin_digits",
      sql`${table.gtin} is null or ${table.gtin} ~ '^[0-9]{8,14}$'`,
    ),
    check(
      "product_variants_volume_positive",
      sql`${table.volumeMl} is null or ${table.volumeMl} > 0`,
    ),
  ],
);

/**
 * Product imagery and documents.
 *
 * `sourceAttribution` and `rightsNotes` exist because retailer imagery is not
 * automatically licensed for reuse; publication checks read these fields.
 */
export const productMedia = pgTable(
  "product_media",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    kind: mediaKindEnum("kind").notNull().default("GALLERY"),
    storageKey: text("storage_key"),
    sourceUrl: text("source_url"),
    altTextFa: text("alt_text_fa"),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceAttribution: text("source_attribution"),
    rightsNotes: text("rights_notes"),
    createdAt: createdAt(),
  },
  (table) => [
    index("product_media_product_idx").on(table.productId, table.sortOrder),
    index("product_media_variant_idx").on(table.variantId),
    check(
      "product_media_location_present",
      sql`${table.storageKey} is not null or ${table.sourceUrl} is not null`,
    ),
  ],
);
