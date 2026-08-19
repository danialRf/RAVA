import Link from "next/link";

import { AdminPageHeader } from "../../components/admin";
import { formatCount, formatToman } from "../../lib/format";
import { adminQueries, requireAdmin } from "../../server/admin";

export default async function AdminOverviewPage() {
  await requireAdmin("OVERVIEW_READ");
  const overview = await adminQueries.overview();

  const metrics = [
    [
      "سفارش در انتظار تهیه",
      formatCount(overview.ordersAwaitingProcurement),
      "/admin/procurement",
    ],
    [
      "پرداخت نیازمند بررسی",
      formatCount(overview.paymentsNeedingReview),
      "/admin/payments",
    ],
    ["درخواست محصول باز", formatCount(overview.openProductRequests), null],
    [
      "وظیفه خرید باز",
      formatCount(overview.openPurchaseTasks),
      "/admin/procurement",
    ],
  ] as const;

  return (
    <>
      <AdminPageHeader
        eyebrow="صف‌های عملیاتی"
        title="نمای کلی"
        copy="فقط داده‌های ثبت‌شده نمایش داده می‌شوند؛ این صفحه آمار تخمینی یا نمایشی ندارد."
      />
      <div className="admin-metrics">
        {metrics.map(([label, value, href]) => {
          const content = (
            <>
              <span>{label}</span>
              <strong>{value}</strong>
            </>
          );
          return href === null ? (
            <div key={label}>{content}</div>
          ) : (
            <Link href={href} key={label}>
              {content}
            </Link>
          );
        })}
      </div>
      <section className="admin-money-summary">
        <h2>وضعیت مالی ثبت‌شده</h2>
        <dl>
          <div>
            <dt>پیش‌پرداخت دریافت‌شده</dt>
            <dd>{formatToman(overview.depositsReceived)} تومان</dd>
          </div>
          <div>
            <dt>مانده حساب سفارش‌های جاری</dt>
            <dd>{formatToman(overview.outstandingBalances)} تومان</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
