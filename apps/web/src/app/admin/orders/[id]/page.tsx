import { formatEurCents, hasAdminPermission } from "@rava/domain";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "../../../../components/admin";
import {
  AdminDetailPanel,
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../../components/admin-ui";
import { AdminEntityStatus } from "../../../../lib/admin-status";
import { formatDate, formatToman } from "../../../../lib/format";
import {
  orderStatusFa,
  procurementStatusFa,
} from "../../../../lib/order-status";
import { adminQueries, requireAdmin } from "../../../../server/admin";
import {
  operateOrderLifecycleAction,
  receiveOrderInGermanyAction,
} from "../../actions";

export default async function AdminOrderDetailsPage({
  params,
  searchParams,
}: PageProps<"/admin/orders/[id]"> & {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("ORDERS_READ");
  const { id } = await params;
  const query = await searchParams;
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
        <AdminEntityStatus status={result.order.status}>
          {orderStatusFa(result.order.status)}
        </AdminEntityStatus>
        <small>{formatDate(result.order.createdAt)}</small>
      </div>
      <AdminFlash notice={query.notice} error={query.error} />
      <AdminNotice title="رکورد مالی قفل‌شده" tone="warning">
        مبلغ نهایی، نرخ تبدیل و اقلام این سفارش از snapshot ثبت‌شده خوانده
        می‌شوند و با تغییرهای بعدی قیمت‌گذاری تغییر نمی‌کنند.
      </AdminNotice>
      <AdminStatGrid>
        <AdminStat
          label="مبلغ قفل‌شده"
          value={`${formatToman(result.order.totalLockedToman)} تومان`}
        />
        <AdminStat
          label="پیش‌پرداخت دریافت‌شده"
          value={`${formatToman(result.order.depositPaidToman)} تومان`}
          tone="success"
        />
        <AdminStat
          label="مانده"
          value={`${formatToman(result.order.balanceDueToman - result.order.balancePaidToman)} تومان`}
          tone={
            result.order.balanceDueToman > result.order.balancePaidToman
              ? "warning"
              : "success"
          }
        />
      </AdminStatGrid>
      {result.order.status === "PURCHASED_GERMANY" && (
        <form
          action={receiveOrderInGermanyAction}
          className="admin-command-bar"
        >
          <input type="hidden" name="id" value={result.order.id} />
          <div>
            <span>مرکز آلمان</span>
            <strong>همه اقلام فیزیکی دریافت شده‌اند؟</strong>
          </div>
          <button type="submit">ثبت دریافت و ورود به صف سفر</button>
        </form>
      )}
      {result.order.status === "BALANCE_PAID" &&
        hasAdminPermission(user.role, "TRIPS_WRITE") && (
          <form
            action={operateOrderLifecycleAction}
            className="admin-command-bar"
          >
            <input type="hidden" name="orderId" value={result.order.id} />
            <input type="hidden" name="action" value="START_LOCAL_DELIVERY" />
            <div>
              <span>ارسال داخلی</span>
              <strong>مانده پرداخت شده و سفارش آماده ارسال است.</strong>
            </div>
            <button type="submit">ورود به صف ارسال</button>
          </form>
        )}
      {result.order.status === "LOCAL_DELIVERY_PENDING" &&
        hasAdminPermission(user.role, "TRIPS_WRITE") && (
          <form
            action={operateOrderLifecycleAction}
            className="admin-form-grid admin-create-panel"
          >
            <input type="hidden" name="orderId" value={result.order.id} />
            <input type="hidden" name="action" value="DISPATCH_LOCAL" />
            <label>
              پیک یا شرکت حمل
              <input name="courier" required minLength={3} />
            </label>
            <label>
              کد پیگیری
              <input name="trackingCode" dir="ltr" required minLength={3} />
            </label>
            <button type="submit">ثبت خروج برای تحویل</button>
          </form>
        )}
      {result.order.status === "OUT_FOR_DELIVERY" &&
        hasAdminPermission(user.role, "TRIPS_WRITE") && (
          <div className="admin-command-bar">
            <form action={operateOrderLifecycleAction}>
              <input type="hidden" name="orderId" value={result.order.id} />
              <button name="action" value="DELIVER">
                تأیید تحویل
              </button>
            </form>
            <form
              action={operateOrderLifecycleAction}
              className="admin-review-form"
            >
              <input type="hidden" name="orderId" value={result.order.id} />
              <input
                name="reason"
                required
                minLength={3}
                placeholder="دلیل ناموفق بودن تحویل"
              />
              <button
                name="action"
                value="DELIVERY_FAILED"
                className="button secondary"
              >
                بازگشت به صف ارسال
              </button>
            </form>
          </div>
        )}
      {result.order.status === "REFUND_PENDING" &&
        hasAdminPermission(user.role, "PAYMENTS_REVIEW") && (
          <form
            action={operateOrderLifecycleAction}
            className="admin-form-grid admin-create-panel"
          >
            <input type="hidden" name="orderId" value={result.order.id} />
            <input type="hidden" name="action" value="COMPLETE_REFUND" />
            <label className="wide">
              شماره پیگیری بازپرداخت
              <input name="refundReference" dir="ltr" required minLength={3} />
            </label>
            <button type="submit">ثبت بازپرداخت کامل</button>
          </form>
        )}
      {result.order.status === "DELIVERED" &&
        hasAdminPermission(user.role, "PAYMENTS_REVIEW") && (
          <details className="admin-create-panel">
            <summary>ثبت درخواست مرجوعی و بازپرداخت</summary>
            <form
              action={operateOrderLifecycleAction}
              className="admin-form-grid"
            >
              <input type="hidden" name="orderId" value={result.order.id} />
              <input type="hidden" name="action" value="REQUEST_REFUND" />
              <label className="wide">
                دلیل مستند
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
              <button className="button danger" type="submit">
                ورود به صف بازپرداخت
              </button>
            </form>
          </details>
        )}
      <div className="admin-order-detail">
        <AdminDetailPanel
          title="اقلام قفل‌شده سفارش"
          description="این اقلام از سفارش قطعی آمده‌اند و با تغییر سبد خرید مشتری عوض نمی‌شوند."
        >
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
                  <dd>
                    <AdminEntityStatus status={item.procurementStatus}>
                      {procurementStatusFa(item.procurementStatus)}
                    </AdminEntityStatus>
                  </dd>
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
        </AdminDetailPanel>
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
