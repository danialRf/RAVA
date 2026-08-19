import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountNav } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { formatToman } from "../../../lib/format";
import { currentUser } from "../../../server/auth";
import { accountQueries } from "../../../server/account";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "سفارش‌های من",
  robots: { index: false, follow: false },
};

const statusLabels: Record<string, string> = {
  DEPOSIT_PENDING: "در انتظار پیش‌پرداخت",
  PROCUREMENT_PENDING: "در صف تهیه از آلمان",
  PURCHASED: "خریداری‌شده",
  IN_TRANSIT_TO_IRAN: "در مسیر ایران",
  READY_FOR_LOCAL_DELIVERY: "آماده تحویل",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};

export default async function OrdersPage() {
  const user = await currentUser();
  if (!user) redirect("/account/login?next=%2Faccount%2Forders");
  const orders = await accountQueries.orders(user.id);

  return (
    <div className="section-shell account-page order-page">
      <PageIntro
        eyebrow="پیگیری خریدها"
        title="سفارش‌های من"
        copy="وضعیت تهیه، پرداخت و تحویل هر سفارش را اینجا می‌بینید."
      />
      <AccountNav />
      {orders.length === 0 ? (
        <section className="empty-state">
          <h2>هنوز سفارشی ندارید</h2>
          <p>پس از پرداخت پیش‌پرداخت، سفارش شما در این صفحه ثبت می‌شود.</p>
          <Link className="button primary" href="/category">
            دیدن محصولات
          </Link>
        </section>
      ) : (
        <section className="order-list" aria-label="فهرست سفارش‌ها">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`}>
              <div>
                <strong dir="ltr">{order.orderNumber}</strong>
                <span>{statusLabels[order.status] ?? "در حال بررسی"}</span>
              </div>
              <div>
                <strong>{formatToman(order.totalLockedToman)} تومان</strong>
                <span>
                  {order.createdAt.toLocaleDateString("fa-IR", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
