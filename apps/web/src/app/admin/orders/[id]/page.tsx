import { formatEurCents } from "@rava/domain";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "../../../../components/admin";
import { formatDate, formatToman } from "../../../../lib/format";
import {
  orderStatusFa,
  procurementStatusFa,
} from "../../../../lib/order-status";
import { adminQueries, requireAdmin } from "../../../../server/admin";

export default async function AdminOrderDetailsPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  await requireAdmin("ORDERS_READ");
  const { id } = await params;
  const result = await adminQueries.orderDetails(id);
  if (result === null) notFound();

  return (
    <>
      <AdminPageHeader
        eyebrow="سفارش قطعی مشتری"
        title={result.order.orderNumber}
        copy={`${result.order.customerName ?? "مشتری"} · ${result.order.customerEmail ?? "ایمیل ثبت نشده"}`}
      />
      <div className="admin-order-toolbar">
        <Link href="/admin/orders">بازگشت به سفارش‌ها</Link>
        <span>{orderStatusFa(result.order.status)}</span>
        <small>{formatDate(result.order.createdAt)}</small>
      </div>
      <div className="admin-order-detail">
        <section>
          <h2>اقلام قفل‌شده سفارش</h2>
          <p>
            این اقلام از سفارش قطعی آمده‌اند و با تغییر سبد خرید مشتری عوض
            نمی‌شوند.
          </p>
          {result.items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.productSnapshot.titleFa}</strong>
                <small dir="ltr">
                  {item.productSnapshot.brand} · {item.offerSnapshot.retailer}
                </small>
              </div>
              <dl>
                <div>
                  <dt>تعداد</dt>
                  <dd>{item.quantity.toLocaleString("fa-IR")}</dd>
                </div>
                <div>
                  <dt>وضعیت تهیه</dt>
                  <dd>{procurementStatusFa(item.procurementStatus)}</dd>
                </div>
                <div>
                  <dt>مبلغ مشتری</dt>
                  <dd>{formatToman(item.lineTotalToman)} تومان</dd>
                </div>
                {item.purchaseEurCents !== null && (
                  <div>
                    <dt>هزینه واقعی خرید</dt>
                    <dd dir="ltr">
                      {formatEurCents(item.purchaseEurCents)} € +{" "}
                      {formatEurCents(item.shippingEurCents ?? 0n)} € shipping
                    </dd>
                  </div>
                )}
              </dl>
              {item.retailerOrderRefMasked && (
                <small dir="ltr">Ref: {item.retailerOrderRefMasked}</small>
              )}
              {item.receiptDocumentId && (
                <a
                  className="admin-receipt-link"
                  href={`/admin/procurement/documents/${item.receiptDocumentId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  مشاهده رسید خصوصی خرید
                </a>
              )}
            </article>
          ))}
        </section>
        <aside className="admin-money-summary">
          <h2>خلاصه مالی</h2>
          <dl>
            <div>
              <dt>مبلغ قفل‌شده</dt>
              <dd>{formatToman(result.order.totalLockedToman)} تومان</dd>
            </div>
            <div>
              <dt>پیش‌پرداخت دریافت‌شده</dt>
              <dd>{formatToman(result.order.depositPaidToman)} تومان</dd>
            </div>
            <div>
              <dt>مانده سفارش</dt>
              <dd>
                {formatToman(
                  result.order.balanceDueToman - result.order.balancePaidToman,
                )}{" "}
                تومان
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
