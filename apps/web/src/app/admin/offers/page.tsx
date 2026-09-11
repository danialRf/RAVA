import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { reviewOfferAction } from "../actions";

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireAdmin("CATALOG_READ");
  const [offers, query] = await Promise.all([
    adminQueries.offers(),
    searchParams,
  ]);
  return (
    <>
      <AdminPageHeader
        eyebrow="پیشنهادهای منبع"
        title="تطبیق و تأیید پیشنهادها"
        copy="پیشنهاد بدون اتصال به تنوع محصول هرگز قابل فروش یا تأیید نیست."
      />
      <AdminNotice title="حقیقتِ منبع" tone="warning">
        تأیید منبع فقط برای پیشنهاد متصل به تنوع محصول ممکن است؛ این کنترل جای
        بررسی فروشنده یا سیاست تأمین را نمی‌گیرد.
      </AdminNotice>
      <AdminFlash notice={query.notice} error={query.error} />
      <AdminStatGrid>
        <AdminStat
          label="پیشنهادها"
          value={offers.length.toLocaleString("fa-IR")}
          hint="داده‌های عرضه‌کننده"
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
      {offers.length === 0 ? (
        <AdminEmptyState>پیشنهادی ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {offers.map((o) => (
            <article className="admin-record static" key={o.id}>
              <div>
                <strong>{o.rawTitle}</strong>
                <small>
                  {o.retailerName} · {o.productTitle ?? "تطبیق‌نیافته"}
                </small>
              </div>
              <div>
                <b dir="ltr">
                  € {(Number(o.sourcePriceEurCents) / 100).toFixed(2)}
                </b>
                <AdminEntityStatus status={o.stockStatus} />
              </div>
              <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                مشاهده منبع
              </a>
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
            </article>
          ))}
        </section>
      )}
    </>
  );
}
