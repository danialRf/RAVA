import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { formatEurCents, hasAdminPermission } from "@rava/domain";
import { adminQueries, requireAdmin } from "../../../server/admin";
import {
  archiveOfferAction,
  reviewOfferAction,
  saveOfferAction,
} from "../actions";

const STOCK_STATUSES = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "PREORDER",
  "UNKNOWN",
] as const;

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("CATALOG_READ");
  const [offers, options, query] = await Promise.all([
    adminQueries.offers(),
    adminQueries.offerFormOptions(),
    searchParams,
  ]);
  const writable = hasAdminPermission(user.role, "CATALOG_WRITE");
  return (
    <>
      <AdminPageHeader
        eyebrow="تنظیمات پیشرفته"
        title="لینک‌های خرید از آلمان"
        copy="اگر می‌خواهید قیمت یک محصول به‌جای مبلغ دستی، از روی قیمت یورو و نرخ ارز حساب شود، لینک خرید آن را اینجا ثبت کنید."
      />
      <AdminNotice title="برای فروش لازم نیست" tone="info">
        برای فروختن یک محصول کافی است در صفحه «محصولات» قیمت فروش را به تومان
        وارد کنید. این صفحه فقط برای محصولاتی است که می‌خواهید قیمتشان خودکار از
        روی فروشگاه آلمانی محاسبه شود.
      </AdminNotice>
      <AdminFlash notice={query.notice} error={query.error} />
      <AdminStatGrid>
        <AdminStat
          label="پیشنهادها"
          value={offers.length.toLocaleString("fa-IR")}
          hint="لینک‌های خرید ثبت‌شده"
        />
        <AdminStat
          label="تأییدنشده"
          value={offers
            .filter((offer) => !offer.sourceVerified)
            .length.toLocaleString("fa-IR")}
          tone="warning"
          hint="نیازمند بررسی منبع"
        />
      </AdminStatGrid>
      {writable && (
        <details className="admin-create-panel">
          <summary>+ افزودن لینک خرید از آلمان</summary>
          <form action={saveOfferAction} className="admin-form-grid">
            <label>
              فروشگاه
              <select name="retailerId" required>
                {options.retailers.map((source) => (
                  <option value={source.id} key={source.id}>
                    {source.name}
                    {source.isEnabled ? "" : " (غیرفعال)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تنوع محصول
              <select name="productVariantId" required>
                {options.variants.map((variant) => (
                  <option value={variant.id} key={variant.id}>
                    {variant.title} ·{" "}
                    {variant.size ?? variant.color ?? variant.sku}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              عنوان در فروشگاه
              <input name="rawTitle" required minLength={2} maxLength={300} />
            </label>
            <label className="wide">
              لینک خرید
              <input
                name="sourceUrl"
                type="url"
                dir="ltr"
                required
                placeholder="https://…"
              />
            </label>
            <label>
              قیمت کالا (یورو)
              <input
                name="sourcePriceEur"
                inputMode="decimal"
                required
                placeholder="49.95"
              />
            </label>
            <label>
              ارسال داخل آلمان (یورو)
              <input name="shippingEur" inputMode="decimal" placeholder="0" />
            </label>
            <label>
              موجودی
              <select name="stockStatus" defaultValue="UNKNOWN">
                {STOCK_STATUSES.map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary">ذخیره به‌عنوان تأییدنشده</button>
          </form>
        </details>
      )}
      {offers.length === 0 ? (
        <AdminEmptyState>پیشنهادی ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {offers.map((o) => (
            <details className="admin-record" key={o.id}>
              <summary>
                <span>
                  <strong>{o.rawTitle}</strong>
                  <small>
                    {o.retailerName} · {o.productTitle ?? "تطبیق‌نیافته"}
                  </small>
                </span>
                <b dir="ltr">€ {formatEurCents(o.sourcePriceEurCents)}</b>
                <AdminEntityStatus status={o.stockStatus} />
                <AdminEntityStatus
                  status={
                    o.expiresAt
                      ? "ARCHIVED"
                      : o.sourceVerified
                        ? "VERIFIED"
                        : "UNVERIFIED"
                  }
                />
              </summary>
              <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                مشاهده منبع
              </a>
              {writable && !o.expiresAt && (
                <form action={saveOfferAction} className="admin-form-grid">
                  <input type="hidden" name="id" value={o.id} />
                  <label>
                    فروشگاه
                    <select name="retailerId" defaultValue={o.retailerId}>
                      {options.retailers.map((source) => (
                        <option value={source.id} key={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    تنوع محصول
                    <select
                      name="productVariantId"
                      defaultValue={o.productVariantId ?? ""}
                      required
                    >
                      <option value="" disabled>
                        انتخاب کنید
                      </option>
                      {options.variants.map((variant) => (
                        <option value={variant.id} key={variant.id}>
                          {variant.title} ·{" "}
                          {variant.size ?? variant.color ?? variant.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    عنوان فروشگاه
                    <input name="rawTitle" defaultValue={o.rawTitle} required />
                  </label>
                  <label className="wide">
                    لینک خرید
                    <input
                      name="sourceUrl"
                      type="url"
                      dir="ltr"
                      defaultValue={o.sourceUrl}
                      required
                    />
                  </label>
                  <label>
                    قیمت کالا (یورو)
                    <input
                      name="sourcePriceEur"
                      defaultValue={formatEurCents(o.sourcePriceEurCents)}
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label>
                    ارسال آلمان (یورو)
                    <input
                      name="shippingEur"
                      defaultValue={
                        o.shippingEurCents === null
                          ? ""
                          : formatEurCents(o.shippingEurCents)
                      }
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    موجودی
                    <select name="stockStatus" defaultValue={o.stockStatus}>
                      {STOCK_STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button>ذخیره تغییرات</button>
                </form>
              )}
              {writable && !o.expiresAt && (
                <div className="admin-action-row">
                  <form action={reviewOfferAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input
                      type="hidden"
                      name="sourceVerified"
                      value={o.sourceVerified ? "false" : "true"}
                    />
                    <button
                      className={
                        o.sourceVerified ? "button secondary" : "button primary"
                      }
                    >
                      {o.sourceVerified ? "لغو تأیید" : "تأیید منبع"}
                    </button>
                  </form>
                  <form action={archiveOfferAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="button danger">آرشیو لینک خرید</button>
                  </form>
                </div>
              )}
            </details>
          ))}
        </section>
      )}
    </>
  );
}
