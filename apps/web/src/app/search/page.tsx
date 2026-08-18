import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyState,
  PageIntro,
  ProductGrid,
  RateUnavailableNotice,
  ResultCount,
} from "../../components/storefront";
import {
  countProducts,
  listCategories,
  listProducts,
} from "../../server/catalog";
import { getStorefrontRate } from "../../server/pricing";
import { readWishlist } from "../../server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جست‌وجو",
  description: "جست‌وجوی محصول، برند یا مدل به فارسی یا لاتین در کاتالوگ روا.",
  alternates: { canonical: "/search" },
  // Result pages carry no independent content worth indexing.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const raw = params.q;
  const query = String((Array.isArray(raw) ? raw[0] : raw) ?? "").trim();

  const filters = { search: query, limit: 24 };
  const [results, total, categories, wishlist, rate] = await Promise.all([
    query === "" ? [] : listProducts(filters),
    query === "" ? 0 : countProducts(filters),
    listCategories(),
    readWishlist(),
    getStorefrontRate(),
  ]);

  return (
    <div className="section-shell search-page">
      <PageIntro
        eyebrow="جست‌وجوی روا"
        title="دنبال چه می‌گردید؟"
        copy="نام محصول، برند یا مدل را به فارسی یا لاتین بنویسید."
      />

      <form className="search-form" action="/search" role="search">
        <label className="sr-only" htmlFor="q">
          عبارت جست‌وجو
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="مثلاً عطر، سرم یا Samba"
          autoComplete="off"
        />
        <button className="button primary">جست‌وجو</button>
      </form>

      <div className="suggestions">
        <span>دسته‌های پیشنهادی:</span>
        {categories.slice(0, 4).map((category) => (
          <Link key={category.slug} href={`/category?type=${category.slug}`}>
            {category.nameFa}
          </Link>
        ))}
      </div>

      {rate === null && <RateUnavailableNotice />}

      {query === "" ? (
        <p className="search-hint">
          برای دیدن نتیجه، عبارتی بنویسید یا از دسته‌بندی‌ها شروع کنید.
        </p>
      ) : results.length === 0 ? (
        <EmptyState
          title={`برای «${query}» نتیجه‌ای نبود`}
          copy="املای دیگری را امتحان کنید، یا درخواست بدهید تا برایتان پیدا کنیم."
        />
      ) : (
        <>
          <div className="results-title">
            <h2>نتیجه برای «{query}»</h2>
            <ResultCount value={total} />
          </div>
          <ProductGrid items={results} wishlist={wishlist} />
        </>
      )}
    </div>
  );
}
