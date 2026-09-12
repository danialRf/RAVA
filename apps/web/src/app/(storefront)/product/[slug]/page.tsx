import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EstimatedPrice,
  PriceUnavailable,
  ProductGrid,
  RateUnavailableNotice,
  SectionHeading,
  SourceBadge,
  TrustPurchasePanel,
} from "../../../../components/storefront";
import { WishlistButton } from "../../../../components/wishlist-button";
import { formatObservedAt, formatToman } from "../../../../lib/format";
import { getProductDetail, listProducts } from "../../../../server/catalog";
import { getStorefrontRate } from "../../../../server/pricing";
import { readWishlist } from "../../../../server/session";
import { addToCartAction } from "../../checkout/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (product === null) return { title: "محصول پیدا نشد" };

  return {
    title: product.seoTitle ?? product.titleFa,
    description:
      product.seoDescription ??
      product.descriptionFa ??
      `${product.titleFa} از ${product.brandName} با منبع مشخص و قیمت تخمینی.`,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.titleFa,
      description: product.descriptionFa ?? product.titleOriginal,
      images: product.images.slice(0, 1).map((image) => ({ url: image.url })),
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (product === null) notFound();

  const [wishlist, rate, related] = await Promise.all([
    readWishlist(),
    getStorefrontRate(),
    listProducts({ categorySlug: product.categorySlug, limit: 4 }),
  ]);

  const lead = product.leadVariant;
  const cover = product.images[0];
  const purchasable = lead !== null && lead.estimate !== null;

  return (
    <div className="section-shell product-page">
      <nav className="breadcrumbs" aria-label="مسیر صفحه">
        <Link href="/">خانه</Link>
        <span>/</span>
        <Link href={`/category?type=${product.categorySlug}`}>
          {product.categoryNameFa}
        </Link>
        <span>/</span>
        <span>{product.titleFa}</span>
      </nav>

      <div className="product-detail">
        <div className="pdp-gallery">
          {cover && (
            <Image
              src={cover.url}
              width={680}
              height={810}
              alt={cover.alt}
              sizes="(max-width: 900px) 92vw, 520px"
              priority
            />
          )}
          {cover?.attribution != null && <span>{cover.attribution}</span>}
        </div>

        <div className="purchase-column">
          <SourceBadge
            tier={lead?.trustTier ?? null}
            source={lead?.retailerName}
          />
          <p className="product-brand" dir="ltr">
            {product.brandName}
          </p>
          <h1>{product.titleFa}</h1>
          <p className="pdp-variant" dir="ltr">
            {product.titleOriginal}
          </p>

          <div className="variant-select">
            <span id="variant-label">مدل‌های موجود</span>
            <ul aria-labelledby="variant-label">
              {product.variants.map((variant) => (
                <li key={variant.id}>
                  <span className={variant.available ? "" : "disabled"}>
                    {variant.label}
                    {!variant.available && " · ناموجود در منبع"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {rate === null && <RateUnavailableNotice />}

          {purchasable ? (
            <EstimatedPrice
              value={lead.estimate!.estimatedToman}
              observedAt={lead.observedAt}
            />
          ) : (
            <PriceUnavailable
              reason={
                rate === null
                  ? "تا دریافت نرخ ارز معتبر، قیمت اعلام نمی‌شود."
                  : "قیمتی برای این محصول ثبت نشده است."
              }
            />
          )}

          <div className="pdp-actions">
            {purchasable ? (
              <form action={addToCartAction} className="wide">
                <input type="hidden" name="variantId" value={lead.id} />
                <input
                  type="hidden"
                  name="offerId"
                  value={lead.sourceOfferId ?? ""}
                />
                <button className="button primary wide">
                  افزودن به سبد خرید
                </button>
              </form>
            ) : (
              <Link className="button secondary wide" href="/find-it">
                استعلام قیمت
              </Link>
            )}
            <WishlistButton
              slug={product.slug}
              title={product.titleFa}
              active={wishlist.includes(product.slug)}
            />
          </div>
          <p className="buy-note">
            {lead?.estimate?.source === "MANUAL"
              ? "قیمت این محصول ثابت است؛ در مرحله تسویه همین مبلغ برای شما قفل می‌شود."
              : "ابتدا قیمت ده‌دقیقه‌ای با نرخ تازه برای شما قفل می‌شود؛ سپس فقط پیش‌پرداخت را می‌پردازید."}
          </p>

          <TrustPurchasePanel
            retailerName={lead?.retailerName ?? null}
            tier={lead?.trustTier ?? null}
            depositToman={lead?.estimate?.depositToman ?? null}
          />
        </div>
      </div>

      <section className="detail-copy">
        <div>
          <p className="eyebrow">جزئیات خرید</p>
          <h2>پیش از سفارش چه می‌دانید؟</h2>
        </div>
        <div>
          {product.descriptionFa != null && (
            <>
              <h3>درباره محصول</h3>
              <p>{product.descriptionFa}</p>
            </>
          )}
          {lead?.estimate?.source !== "MANUAL" && (
            <>
              <h3>منبع و مدرک خرید</h3>
              <p>
                {lead?.retailerName == null
                  ? "برای این محصول هنوز منبع فعالی ثبت نشده است."
                  : `این پیشنهاد از ${lead.retailerName} ثبت شده است. پس از تهیه، مدرک خرید مطابق سیاست دسترسی سفارش ثبت می‌شود.`}
              </p>
            </>
          )}
          <h3>قیمت</h3>
          {lead?.estimate?.source === "MANUAL" ? (
            <p>
              قیمت این محصول توسط فروشگاه روا تعیین شده است و همان مبلغی است که
              می‌پردازید. تا زمانی که فروشگاه قیمت را تغییر ندهد، این مبلغ ثابت
              می‌ماند.
            </p>
          ) : (
            <p>
              قیمت نمایش‌داده‌شده تخمینی است و بر پایه قیمت منبع
              {lead?.observedAt != null &&
                ` (آخرین بررسی: ${formatObservedAt(lead.observedAt)})`}{" "}
              و نرخ ارز ثبت‌شده محاسبه می‌شود. در تسویه یک پیشنهاد قیمت
              کوتاه‌مدت می‌بینید و هیچ مبلغی بدون تأیید شما تغییر نمی‌کند.
            </p>
          )}
          {lead?.estimate != null && (
            <>
              <h3>پیش‌پرداخت</h3>
              <p>
                پیش‌پرداخت تخمینی این کالا حدود{" "}
                {formatToman(lead.estimate.depositToman)} تومان است و باقی مبلغ
                پیش از تحویل تسویه می‌شود.
              </p>
            </>
          )}
          <h3>زمان تحویل</h3>
          <p>
            تحویل به پنجره سفر و مسیر تهیه وابسته است؛ بنابراین به‌جای تاریخ
            دقیق ساختگی، بازه تقریبی اعلام می‌شود.
          </p>
        </div>
      </section>

      {related.filter((item) => item.slug !== product.slug).length > 0 && (
        <section className="section-block">
          <SectionHeading
            title="انتخاب‌های مشابه"
            href={`/category?type=${product.categorySlug}`}
          />
          <ProductGrid
            items={related
              .filter((item) => item.slug !== product.slug)
              .slice(0, 3)}
            wishlist={wishlist}
          />
        </section>
      )}
    </div>
  );
}
