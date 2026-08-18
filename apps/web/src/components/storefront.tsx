import Image from "next/image";
import Link from "next/link";
import { RAVA_BRAND } from "@rava/ui";
import type { TrustTier } from "@rava/domain";
import type { ProductCardModel } from "../server/catalog";
import {
  formatCount,
  formatDiscountBps,
  formatObservedAt,
  formatToman,
} from "../lib/format";
import { Icon } from "./icons";
import { WishlistButton } from "./wishlist-button";

export function Announcement({ message }: { message: string }) {
  return (
    <div className="announcement">
      <span>{message}</span>
      <Link href="/authenticity">روش خرید از آلمان</Link>
    </div>
  );
}

export function Header({ announcement }: { announcement: string }) {
  return (
    <>
      <Announcement message={announcement} />
      <header className="header">
        <div className="header-inner">
          <Link className="logo" href="/" aria-label="صفحه اصلی روا">
            <strong>{RAVA_BRAND.nameFa}</strong>
            <bdi dir="ltr">RAVA</bdi>
          </Link>
          <Link className="header-search" href="/search">
            <Icon name="search" width="20" />
            <span>جست‌وجوی محصول، برند یا مدل</span>
          </Link>
          <nav className="desktop-actions" aria-label="ابزارهای فروشگاه">
            <Link href="/account">
              <Icon name="user" width="21" />
              حساب من
            </Link>
            <Link href="/wishlist">
              <Icon name="heart" width="21" />
              علاقه‌مندی
            </Link>
          </nav>
        </div>
        <nav className="desktop-nav" aria-label="دسته‌بندی‌های اصلی">
          <Link href="/category">دسته‌بندی‌ها</Link>
          <Link href="/category?sort=discount">فرصت‌های آلمان</Link>
          <Link href="/authenticity">اصالت و منبع</Link>
          <Link href="/find-it">برام پیدا کن</Link>
        </nav>
      </header>
    </>
  );
}

export function BottomNav() {
  const items = [
    ["home", "خانه", "/"],
    ["grid", "دسته‌بندی", "/category"],
    ["search", "جست‌وجو", "/search"],
    ["heart", "علاقه‌مندی", "/wishlist"],
    ["user", "حساب من", "/account"],
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="ناوبری موبایل">
      {items.map(([icon, label, href]) => (
        <Link href={href} key={label}>
          <Icon name={icon} width="21" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link className="logo footer-logo" href="/">
          <strong>روا</strong>
          <bdi dir="ltr">RAVA</bdi>
        </Link>
        <p>{RAVA_BRAND.taglineFa}</p>
      </div>
      <div>
        <h2>راهنمای خرید</h2>
        <Link href="/authenticity">اصالت و منبع</Link>
        <Link href="/find-it">درخواست محصول</Link>
        <Link href="/account">پیگیری سفارش</Link>
      </div>
      <div>
        <h2>پشتیبانی</h2>
        <p>پاسخ‌گویی شنبه تا چهارشنبه</p>
        <p>قیمت‌های عمومی تخمینی‌اند و در تسویه دوباره محاسبه می‌شوند.</p>
      </div>
    </footer>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = "مشاهده همه",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p>{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href}>
          {linkLabel}
          <Icon name="arrow" width="18" />
        </Link>
      )}
    </div>
  );
}

/**
 * Source wording per trust tier.
 *
 * None of these claim physical authentication; they describe how the source
 * was categorised, which is the only thing the database actually knows.
 */
const TRUST_LABELS: Record<TrustTier, string> = {
  OFFICIAL_BRAND: "فروشگاه رسمی برند",
  AUTHORIZED_RETAILER: "فروشنده مجاز",
  TRUSTED_MARKETPLACE: "بازارگاه با فروشنده بررسی‌شده",
  UNVERIFIED: "نیازمند بررسی منبع",
};

export function SourceBadge({
  tier,
  source,
}: {
  tier: TrustTier | null;
  source?: string | null | undefined;
}) {
  const verified = tier !== null && tier !== "UNVERIFIED";
  return (
    <span className={`source-badge ${verified ? "verified" : "review"}`}>
      <Icon name="shield" width="15" />
      {tier === null ? "منبع ثبت‌نشده" : TRUST_LABELS[tier]}
      {source != null && <span className="sr-only">: {source}</span>}
    </span>
  );
}

export function EstimatedPrice({
  value,
  compact = false,
  observedAt,
}: {
  value: bigint;
  compact?: boolean;
  observedAt?: Date | null;
}) {
  return (
    <div className={`estimated-price ${compact ? "compact" : ""}`}>
      <span>قیمت تخمینی</span>
      <strong>
        حدود {formatToman(value)} <small>تومان</small>
      </strong>
      {!compact && (
        <>
          <p>قیمت نهایی هنگام ثبت سفارش با نرخ به‌روز محاسبه می‌شود.</p>
          {observedAt != null && (
            <p className="price-observed">
              قیمت منبع، آخرین بررسی: {formatObservedAt(observedAt)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Shown instead of a number whenever we cannot price something honestly. */
export function PriceUnavailable({
  reason = "قیمت این محصول در حال حاضر قابل اعلام نیست.",
  compact = false,
}: {
  reason?: string;
  compact?: boolean;
}) {
  return (
    <div className={`estimated-price unavailable ${compact ? "compact" : ""}`}>
      <span>قیمت تخمینی</span>
      <strong>در دسترس نیست</strong>
      {!compact && <p>{reason}</p>}
    </div>
  );
}

export function ProductCard({
  product,
  wishlisted = false,
}: {
  product: ProductCardModel;
  wishlisted?: boolean;
}) {
  const discountBps = product.estimate?.discountBps ?? null;
  return (
    <article className="product-card">
      <div className="product-media">
        <Link
          href={`/product/${product.slug}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Image
            src={product.imageUrl}
            alt=""
            width={520}
            height={620}
            sizes="(max-width: 720px) 45vw, 260px"
          />
        </Link>
        {discountBps !== null && (
          <span className="discount-badge">
            {formatDiscountBps(discountBps)} کاهش قیمت منبع
          </span>
        )}
        <WishlistButton
          slug={product.slug}
          title={product.titleFa}
          active={wishlisted}
        />
      </div>
      <div className="product-info">
        <SourceBadge tier={product.trustTier} source={product.retailerName} />
        <p className="product-brand" dir="ltr">
          {product.brandName}
        </p>
        <h3>
          <Link href={`/product/${product.slug}`}>{product.titleFa}</Link>
        </h3>
        <p className="variant" dir="ltr">
          {product.titleOriginal}
        </p>
        {product.estimate === null ? (
          <PriceUnavailable compact />
        ) : (
          <EstimatedPrice value={product.estimate.estimatedToman} compact />
        )}
        <p className="delivery-note">
          {product.stockStatus === null
            ? "در حال حاضر پیشنهاد فعالی ثبت نشده است"
            : "تحویل تقریبی ۲ تا ۶ ماه"}
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  wishlist = [],
  className = "",
}: {
  items: readonly ProductCardModel[];
  wishlist?: readonly string[];
  className?: string;
}) {
  return (
    <div className={`product-grid ${className}`}>
      {items.map((product) => (
        <ProductCard
          key={product.slug}
          product={product}
          wishlisted={wishlist.includes(product.slug)}
        />
      ))}
    </div>
  );
}

export function TrustPurchasePanel({
  retailerName,
  tier,
  depositToman,
}: {
  retailerName: string | null;
  tier: TrustTier | null;
  depositToman: bigint | null;
}) {
  return (
    <div className="trust-panel">
      <div>
        <Icon name="shield" width="26" />
        <div>
          <strong>{retailerName ?? "منبع هنوز ثبت نشده"}</strong>
          <p>
            {tier === null
              ? "تا ثبت منبع، سفارش این کالا ممکن نیست."
              : "مدرک خرید پس از تهیه ثبت می‌شود."}
          </p>
        </div>
      </div>
      <dl>
        <div>
          <dt>پیش‌پرداخت تخمینی</dt>
          <dd>
            {depositToman === null
              ? "پس از استعلام"
              : `${formatToman(depositToman)} تومان`}
          </dd>
        </div>
        <div>
          <dt>زمان تحویل</dt>
          <dd>۲ تا ۶ ماه</dd>
        </div>
        <div>
          <dt>اعتبار قیمت نهایی</dt>
          <dd>۱۰ دقیقه در تسویه</dd>
        </div>
      </dl>
    </div>
  );
}

export function EmptyState({
  title = "چیزی پیدا نشد",
  copy = "عبارت دیگری را امتحان کنید یا درخواست محصول بدهید.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">ر</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      <Link className="button secondary" href="/find-it">
        برام پیدا کن
      </Link>
    </div>
  );
}

/** Banner used when the FX provider cannot supply a usable rate. */
export function RateUnavailableNotice() {
  return (
    <div className="rate-notice" role="status">
      <Icon name="shield" width="20" />
      <div>
        <strong>نرخ ارز به‌روز در دسترس نیست</strong>
        <p>
          تا زمان دریافت نرخ معتبر، قیمت تخمینی نمایش داده نمی‌شود. می‌توانید
          درخواست استعلام ثبت کنید.
        </p>
      </div>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="page-intro">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{copy}</span>
    </header>
  );
}

export function ResultCount({ value }: { value: number }) {
  return <p>{formatCount(value)} محصول</p>;
}
