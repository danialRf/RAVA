import Link from "next/link";
import Image from "next/image";
import { Icon } from "../components/icons";
import {
  EmptyState,
  ProductGrid,
  RateUnavailableNotice,
  SectionHeading,
} from "../components/storefront";
import {
  getContent,
  listBrands,
  listCategories,
  listProducts,
  listProductsBySlugs,
} from "../server/catalog";
import { getStorefrontRate } from "../server/pricing";
import { readRecentlyViewed, readWishlist } from "../server/session";
import { formatCount } from "../lib/format";

// Prices, stock and the trip window are live data, so the home page is
// rendered per request rather than baked at build time.
export const dynamic = "force-dynamic";

interface HeroBody {
  eyebrow?: string;
  lead?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
}

interface TrustBody {
  eyebrow?: string;
  lead?: string;
  steps?: { title: string; body: string }[];
}

interface FindItBody {
  eyebrow?: string;
  lead?: string;
  ctaLabel?: string;
}

export default async function HomePage() {
  const [content, categories, deals, newest, brands, wishlist, recentSlugs] =
    await Promise.all([
      getContent(["home.hero", "home.trust", "home.find_it"]),
      listCategories(),
      listProducts({ sort: "discount", discountOnly: true, limit: 4 }),
      listProducts({ sort: "newest", limit: 8 }),
      listBrands(6),
      readWishlist(),
      readRecentlyViewed(),
    ]);

  const [rate, recentlyViewed] = await Promise.all([
    getStorefrontRate(),
    listProductsBySlugs(recentSlugs.slice(0, 4)),
  ]);

  const hero = content.get("home.hero");
  const heroBody = (hero?.body ?? {}) as HeroBody;
  const trust = content.get("home.trust");
  const trustBody = (trust?.body ?? {}) as TrustBody;
  const findIt = content.get("home.find_it");
  const findItBody = (findIt?.body ?? {}) as FindItBody;

  return (
    <>
      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow">
            {heroBody.eyebrow ?? "انتخاب‌های آلمان، با مسیر روشن"}
          </p>
          <h1>{hero?.title ?? "چیزی که دوست دارید، از منبعی که می‌شناسید."}</h1>
          <p>
            {heroBody.lead ??
              "روا خرید از فروشگاه‌های منتخب آلمان را با قیمت تخمینی شفاف و پیگیری مرحله‌به‌مرحله ساده می‌کند."}
          </p>
          <div className="hero-actions">
            <Link
              className="button primary"
              href={heroBody.primaryCtaHref ?? "/category"}
            >
              {heroBody.primaryCtaLabel ?? "دیدن انتخاب‌ها"}
            </Link>
            <Link className="text-link" href="/find-it">
              محصول خاصی می‌خواهید؟ <Icon name="arrow" width="18" />
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-frame hero-main">
            <Image
              src={newest[0]?.imageUrl ?? "/products/perfume.svg"}
              width={520}
              height={620}
              alt={newest[0]?.imageAlt ?? "نمونه تصویری محصول در ویترین روا"}
              sizes="(max-width: 720px) 60vw, 320px"
              priority
            />
          </div>
          <div className="hero-frame hero-small">
            <Image
              src={newest[1]?.imageUrl ?? "/products/serum.svg"}
              width={520}
              height={620}
              alt={newest[1]?.imageAlt ?? "نمونه تصویری محصول مراقبت پوست"}
              sizes="(max-width: 720px) 35vw, 200px"
              priority
            />
          </div>
          <span className="hero-caption">تازه‌ترین انتخاب‌های کاتالوگ</span>
        </div>
      </section>

      <form className="home-search" action="/search" role="search">
        <label className="sr-only" htmlFor="home-q">
          جست‌وجوی محصول
        </label>
        <Icon name="search" width="20" />
        <input
          id="home-q"
          name="q"
          placeholder="نام محصول، برند یا مدل"
          autoComplete="off"
        />
        <button className="button primary">جست‌وجو</button>
      </form>

      {rate === null && (
        <div className="section-shell">
          <RateUnavailableNotice />
        </div>
      )}

      <section className="trust-strip" aria-label="مزیت‌های خرید از روا">
        <div>
          <Icon name="shield" width="25" />
          <span>
            <strong>منبع روشن</strong>نام فروشگاه و سطح بررسی را می‌بینید.
          </span>
        </div>
        <div>
          <span className="trust-number">٪۳۵</span>
          <span>
            <strong>پرداخت مرحله‌ای</strong>معمولاً با پیش‌پرداخت شروع می‌کنید.
          </span>
        </div>
        <div>
          <span className="trust-number">۲–۶</span>
          <span>
            <strong>ماه تا تحویل</strong>بازه واقعی، بدون وعده دقیق ساختگی.
          </span>
        </div>
      </section>

      <section className="section-shell section-block">
        <SectionHeading
          eyebrow="از کجا شروع کنیم؟"
          title="دسته‌بندی‌ها"
          href="/category"
        />
        <div className="category-row">
          {categories.map((category) => (
            <Link href={`/category?type=${category.slug}`} key={category.slug}>
              <span>{category.nameFa.slice(0, 1)}</span>
              <strong>{category.nameFa}</strong>
              <small>{formatCount(category.productCount)} محصول</small>
              <Icon name="arrow" width="17" />
            </Link>
          ))}
        </div>
      </section>

      {deals.length > 0 && (
        <section className="section-shell section-block products-section">
          <SectionHeading
            eyebrow="کاهش قیمت دیده‌شده در منبع"
            title="فرصت‌های آلمان"
            href="/category?sort=discount"
          />
          <ProductGrid items={deals} wishlist={wishlist} />
        </section>
      )}

      <section className="section-shell section-block products-section">
        <SectionHeading
          eyebrow="تازه‌ترین‌ها"
          title="جدید در کاتالوگ"
          href="/category?sort=newest"
        />
        {newest.length === 0 ? (
          <EmptyState
            title="هنوز محصولی منتشر نشده است"
            copy="به‌زودی انتخاب‌های تازه اضافه می‌شود."
          />
        ) : (
          <ProductGrid items={newest} wishlist={wishlist} />
        )}
      </section>

      {brands.length > 0 && (
        <section className="section-shell section-block">
          <SectionHeading eyebrow="برندها" title="برندهای پرتکرار" />
          <div className="brand-row">
            {brands.map((brand) => (
              <Link href={`/category?brand=${brand.slug}`} key={brand.slug}>
                <strong dir="ltr">{brand.name}</strong>
                <small>{formatCount(brand.productCount)} محصول</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentlyViewed.length > 0 && (
        <section className="section-shell section-block products-section">
          <SectionHeading eyebrow="ادامه بدهید" title="بازدیدهای اخیر شما" />
          <ProductGrid items={recentlyViewed} wishlist={wishlist} />
        </section>
      )}

      <section className="source-story">
        <div>
          <p className="eyebrow">{trustBody.eyebrow ?? "چرا منبع مهم است؟"}</p>
          <h2>{trust?.title ?? "اعتماد، قبل از جعبه شروع می‌شود."}</h2>
          <p>
            {trustBody.lead ??
              "برای هر پیشنهاد، منبع خرید و وضعیت بررسی آن کنار محصول قرار می‌گیرد."}
          </p>
          <Link className="button secondary" href="/authenticity">
            روش بررسی اصالت و منبع
          </Link>
        </div>
        <ol>
          {(
            trustBody.steps ?? [
              {
                title: "انتخاب منبع",
                body: "پیشنهاد فقط با اطلاعات قابل بررسی نمایش داده می‌شود.",
              },
              {
                title: "قیمت تازه",
                body: "پیش از پرداخت، مبلغ با نرخ به‌روز محاسبه می‌شود.",
              },
              {
                title: "ثبت مسیر خرید",
                body: "وضعیت سفارش از آلمان تا ایران قابل پیگیری است.",
              },
            ]
          ).map((step, index) => (
            <li key={step.title}>
              <span>{formatCount(index + 1)}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="find-cta section-shell">
        <div>
          <p>{findItBody.eyebrow ?? "پیدایش نکردید؟"}</p>
          <h2>{findIt?.title ?? "لینک یا عکسش را برای ما بفرستید."}</h2>
          <span>
            {findItBody.lead ??
              "درخواست را بررسی می‌کنیم و اگر امکان تهیه باشد، گزینه و قیمت را شفاف پیشنهاد می‌دهیم."}
          </span>
        </div>
        <Link className="button light" href="/find-it">
          {findItBody.ctaLabel ?? "برام پیدا کن"}{" "}
          <Icon name="arrow" width="19" />
        </Link>
      </section>
    </>
  );
}
