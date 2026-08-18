import Link from "next/link";
import type { Metadata } from "next";
import { STOREFRONT_SORTS, type StorefrontSort } from "@rava/db";
import { Icon } from "../../components/icons";
import {
  EmptyState,
  PageIntro,
  ProductGrid,
  RateUnavailableNotice,
  ResultCount,
} from "../../components/storefront";
import {
  countProducts,
  listBrands,
  listCategories,
  listProducts,
} from "../../server/catalog";
import { getStorefrontRate } from "../../server/pricing";
import { readWishlist } from "../../server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "فروشگاه",
  description:
    "انتخاب‌های منتشرشده روا با منبع مشخص و قیمت تخمینی بر پایه نرخ ثبت‌شده.",
  alternates: { canonical: "/category" },
};

const SORT_LABELS: Record<StorefrontSort, string> = {
  recommended: "پیشنهادی",
  newest: "جدیدترین",
  discount: "بیشترین کاهش قیمت منبع",
  "price-low": "قیمت کم به زیاد",
  "price-high": "قیمت زیاد به کم",
};

function parseSort(value: string | undefined): StorefrontSort {
  const match = STOREFRONT_SORTS.find((sort) => sort === value);
  return match ?? "recommended";
}

function single(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export default async function CategoryPage({
  searchParams,
}: PageProps<"/category">) {
  const params = await searchParams;
  const categorySlug = single(params.type);
  const brandSlug = single(params.brand);
  const sort = parseSort(single(params.sort));
  const verifiedOnly = single(params.available) === "1";
  const discountOnly = single(params.deals) === "1" || sort === "discount";

  const filters = {
    categorySlug,
    brandSlug,
    sort,
    verifiedOnly,
    discountOnly,
    limit: 24,
  };

  const [products, total, categories, brands, wishlist, rate] =
    await Promise.all([
      listProducts(filters),
      countProducts(filters),
      listCategories(),
      listBrands(10),
      readWishlist(),
      getStorefrontRate(),
    ]);

  const activeCategory = categories.find(
    (category) => category.slug === categorySlug,
  );

  /** Rebuilds the query string with one parameter replaced. */
  function hrefWith(overrides: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      type: categorySlug,
      brand: brandSlug,
      sort: sort === "recommended" ? undefined : sort,
      available: verifiedOnly ? "1" : undefined,
      deals: discountOnly && sort !== "discount" ? "1" : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value !== undefined) next.set(key, value);
    }
    const query = next.toString();
    return query === "" ? "/category" : `/category?${query}`;
  }

  return (
    <div className="section-shell listing-page">
      <PageIntro
        eyebrow="فروشگاه روا"
        title={activeCategory?.nameFa ?? "همه انتخاب‌ها"}
        copy="قیمت‌ها تخمینی‌اند و هنگام ثبت سفارش با نرخ تازه محاسبه می‌شوند."
      />

      {rate === null && <RateUnavailableNotice />}

      <div className="listing-toolbar">
        <nav className="sort-links" aria-label="مرتب‌سازی">
          {STOREFRONT_SORTS.map((option) => (
            <Link
              key={option}
              href={hrefWith({
                sort: option === "recommended" ? undefined : option,
              })}
              aria-current={sort === option ? "true" : undefined}
              className={sort === option ? "active" : ""}
            >
              {SORT_LABELS[option]}
            </Link>
          ))}
        </nav>
        <ResultCount value={total} />
      </div>

      {(sort === "price-low" || sort === "price-high") && (
        <p className="sort-basis">
          مرتب‌سازی بر پایه قیمت منبع (یورو) و نرخ ثبت‌شده هنگام نمایش است.
        </p>
      )}

      <div className="listing-layout">
        {/* A details element gives a real mobile drawer with no client JS; on
            desktop the summary is hidden and the panel is always visible. */}
        <details className="filter-drawer" id="filters">
          <summary>
            <Icon name="filter" width="20" />
            فیلترها
          </summary>
          <div className="filter-panel" aria-label="فیلتر محصولات">
            <fieldset>
              <legend>دسته‌بندی</legend>
              <Link
                href={hrefWith({ type: undefined })}
                className={categorySlug === undefined ? "active" : ""}
              >
                همه دسته‌ها
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={hrefWith({ type: category.slug })}
                  className={categorySlug === category.slug ? "active" : ""}
                >
                  {category.nameFa}
                </Link>
              ))}
            </fieldset>
            <fieldset>
              <legend>برند</legend>
              <Link
                href={hrefWith({ brand: undefined })}
                className={brandSlug === undefined ? "active" : ""}
              >
                همه برندها
              </Link>
              {brands.map((brand) => (
                <Link
                  key={brand.slug}
                  href={hrefWith({ brand: brand.slug })}
                  className={brandSlug === brand.slug ? "active" : ""}
                >
                  <bdi dir="ltr">{brand.name}</bdi>
                </Link>
              ))}
            </fieldset>
            <fieldset>
              <legend>وضعیت</legend>
              <Link
                href={hrefWith({ available: verifiedOnly ? undefined : "1" })}
                className={verifiedOnly ? "active" : ""}
              >
                فقط دارای پیشنهاد فعال
              </Link>
              <Link
                href={hrefWith({ deals: discountOnly ? undefined : "1" })}
                className={discountOnly ? "active" : ""}
              >
                فقط کاهش قیمت منبع
              </Link>
            </fieldset>
          </div>
        </details>

        {products.length === 0 ? (
          <EmptyState
            title="با این فیلترها محصولی نیست"
            copy="یک فیلتر را بردارید یا درخواست محصول ثبت کنید."
          />
        ) : (
          <ProductGrid items={products} wishlist={wishlist} />
        )}
      </div>
    </div>
  );
}
