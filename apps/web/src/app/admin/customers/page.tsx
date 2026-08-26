import Link from "next/link";
import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatToman } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminCustomersPage() {
  await requireAdmin("CUSTOMERS_READ");
  const customers = await adminQueries.customers();
  return (
    <>
      <AdminPageHeader
        eyebrow="مشتریان"
        title="نمای عملیاتی مشتریان"
        copy="فقط اطلاعات تماس، سفارش و مبلغ پرداخت‌شده نمایش داده می‌شود؛ پروفایل‌سازی غیرضروری انجام نمی‌دهیم."
      />
      {customers.length === 0 ? (
        <AdminEmptyState>مشتری ثبت‌شده‌ای وجود ندارد.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {customers.map((c) => (
            <article className="admin-record static" key={c.id}>
              <div>
                <strong>{c.displayName ?? "بدون نام"}</strong>
                <small dir="ltr">{c.email ?? c.phoneE164 ?? "—"}</small>
              </div>
              <mark>{c.status}</mark>
              <span>{c.orderCount} سفارش</span>
              <span>{formatToman(c.totalPaidToman)} تومان پرداخت‌شده</span>
              <Link href={`/admin/orders?customer=${c.id}`}>سفارش‌ها</Link>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
