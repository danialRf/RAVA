import Link from "next/link";

import { AdminPageHeader } from "../../components/admin";
import {
  AdminActionButton,
  AdminActionButtons,
  AdminDetailPanel,
} from "../../components/admin-ui";
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
        title="امروز چه چیزی نیاز به اقدام دارد؟"
        copy="صف‌های واقعی را از همین‌جا باز کنید؛ هیچ آمار تخمینی یا نمایشی در این صفحه وجود ندارد."
      />
      <section className="admin-command-bar" aria-label="دسترسی سریع">
        <div>
          <span>دسترسی سریع</span>
          <strong>عملیات روزانه</strong>
        </div>
        <AdminActionButtons>
          <AdminActionButton href="/admin/payments" tone="primary">
            بررسی پرداخت‌ها
          </AdminActionButton>
          <AdminActionButton href="/admin/procurement">
            ادامه تأمین
          </AdminActionButton>
          <AdminActionButton href="/admin/orders">
            همه سفارش‌ها
          </AdminActionButton>
        </AdminActionButtons>
      </section>
      <div className="admin-metrics">
        {metrics.map(([label, value, href]) => {
          const content = (
            <>
              <span>{label}</span>
              <strong>{value}</strong>
              {href !== null ? (
                <small>باز کردن صف ←</small>
              ) : (
                <small>فقط نمایش</small>
              )}
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
      <AdminDetailPanel
        title="وضعیت مالی ثبت‌شده"
        description="مبالغ قطعی ثبت‌شده در سفارش‌های جاری"
      >
        <div className="admin-money-summary">
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
        </div>
      </AdminDetailPanel>
    </>
  );
}
