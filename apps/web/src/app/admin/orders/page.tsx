import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatDate, formatToman } from "../../../lib/format";
import { orderStatusFa } from "../../../lib/order-status";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminOrdersPage() {
  await requireAdmin("ORDERS_READ");
  const orders = await adminQueries.orders();
  return (
    <>
      <AdminPageHeader
        eyebrow="صف سفارش"
        title="سفارش‌ها"
        copy="جدیدترین سفارش‌های واقعی و وضعیت فعلی آن‌ها."
      />
      {orders.length === 0 ? (
        <AdminEmptyState>هنوز سفارشی ثبت نشده است.</AdminEmptyState>
      ) : (
        <div className="admin-list">
          {orders.map((order) => (
            <article key={order.id}>
              <div>
                <Link href={`/admin/orders/${order.id}`} dir="ltr">
                  <strong>{order.orderNumber}</strong>
                </Link>
                <span>
                  {order.customerName ??
                    order.customerEmail ??
                    "مشتری بدون نام"}
                </span>
              </div>
              <div>
                <span className="admin-status">
                  {orderStatusFa(order.status)}
                </span>
                <small>{formatDate(order.createdAt)}</small>
              </div>
              <div>
                <strong>{formatToman(order.totalLockedToman)} تومان</strong>
                <small>
                  پرداخت‌شده: {formatToman(order.depositPaidToman)} تومان
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
