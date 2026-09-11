import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminDataTable,
  AdminFilterBar,
  AdminStatGrid,
  AdminStat,
} from "../../../components/admin-ui";
import { formatDate, formatToman } from "../../../lib/format";
import { orderStatusFa } from "../../../lib/order-status";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await requireAdmin("ORDERS_READ");
  const { customer } = await searchParams;
  const orders = await adminQueries.orders(customer);
  const outstanding = orders.filter(
    (order) => order.depositPaidToman < order.totalLockedToman,
  ).length;
  return (
    <>
      <AdminPageHeader
        eyebrow="صف سفارش"
        title="سفارش‌ها"
        copy="جدیدترین سفارش‌های واقعی و وضعیت فعلی آن‌ها."
      />
      <AdminFilterBar
        resultCount={`${orders.length.toLocaleString("fa-IR")} سفارش`}
      >
        <form action="/admin/orders" className="admin-inline-search">
          <label>
            شناسه مشتری
            <input
              name="customer"
              defaultValue={customer ?? ""}
              dir="ltr"
              placeholder="شناسه مشتری"
            />
          </label>
          <button className="admin-action-button" type="submit">
            اعمال فیلتر
          </button>
        </form>
      </AdminFilterBar>
      <AdminStatGrid>
        <AdminStat
          label="نمایش فعلی"
          value={orders.length.toLocaleString("fa-IR")}
          hint="جدیدترین سفارش‌ها"
        />
        <AdminStat
          label="نیازمند پیگیری مالی"
          value={outstanding.toLocaleString("fa-IR")}
          tone={outstanding ? "warning" : "success"}
          hint="مانده پرداخت‌نشده"
        />
      </AdminStatGrid>
      {orders.length === 0 ? (
        <AdminEmptyState>هنوز سفارشی ثبت نشده است.</AdminEmptyState>
      ) : (
        <AdminDataTable
          caption="فهرست سفارش‌های فروشگاه"
          columns={[
            { key: "order", label: "سفارش" },
            { key: "customer", label: "مشتری" },
            { key: "status", label: "وضعیت" },
            { key: "amount", label: "مبلغ قطعی", align: "end" },
            { key: "created", label: "ثبت" },
          ]}
          rows={orders.map((order) => ({
            id: order.id,
            cells: {
              order: (
                <Link href={`/admin/orders/${order.id}`} dir="ltr">
                  <strong>{order.orderNumber}</strong>
                </Link>
              ),
              customer:
                order.customerName ?? order.customerEmail ?? "مشتری بدون نام",
              status: (
                <AdminEntityStatus status={order.status}>
                  {orderStatusFa(order.status)}
                </AdminEntityStatus>
              ),
              amount: (
                <>
                  <strong>{formatToman(order.totalLockedToman)} تومان</strong>
                  <small>
                    پرداخت: {formatToman(order.depositPaidToman)} تومان
                  </small>
                </>
              ),
              created: formatDate(order.createdAt),
            },
          }))}
        />
      )}
    </>
  );
}
