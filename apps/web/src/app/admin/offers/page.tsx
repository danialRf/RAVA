import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
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
      {query.notice && <p className="admin-flash success">{query.notice}</p>}
      {query.error && <p className="admin-flash error">{query.error}</p>}
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
                <span>{o.stockStatus}</span>
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
                <button>{o.sourceVerified ? "لغو تأیید" : "تأیید منبع"}</button>
              </form>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
