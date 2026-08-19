import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatEurCents } from "@rava/domain";
import { formatDate } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";

function formatEuroCents(value: bigint | null): string {
  if (value === null) return "سقف خرید ثبت نشده";
  return `${formatEurCents(value)} €`;
}

export default async function AdminProcurementPage() {
  await requireAdmin("PROCUREMENT_READ");
  const items = await adminQueries.procurementQueue();
  return (
    <>
      <AdminPageHeader
        eyebrow="خرید آلمان"
        title="صف تدارکات"
        copy="برای استفاده خریدار در موبایل: کالا، منبع و سقف مجاز خرید در یک نگاه."
      />
      {items.length === 0 ? (
        <AdminEmptyState>کالایی در صف تهیه نیست.</AdminEmptyState>
      ) : (
        <div className="procurement-grid">
          {items.map((item) => (
            <article key={item.id}>
              <span className="admin-status" dir="ltr">
                {item.procurementStatus}
              </span>
              <h2>{item.productSnapshot.titleFa}</h2>
              <p dir="ltr">
                {item.productSnapshot.brand} ·{" "}
                {item.productSnapshot.titleOriginal}
              </p>
              <dl>
                <div>
                  <dt>سفارش</dt>
                  <dd dir="ltr">{item.orderNumber}</dd>
                </div>
                <div>
                  <dt>تعداد</dt>
                  <dd>{item.quantity.toLocaleString("fa-IR")}</dd>
                </div>
                <div>
                  <dt>سقف خرید</dt>
                  <dd dir="ltr">
                    {formatEuroCents(item.maxSourcePriceEurCents)}
                  </dd>
                </div>
                <div>
                  <dt>ورود به صف</dt>
                  <dd>{formatDate(item.createdAt)}</dd>
                </div>
              </dl>
              <a
                href={item.offerSnapshot.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                بازکردن منبع خرید
              </a>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
