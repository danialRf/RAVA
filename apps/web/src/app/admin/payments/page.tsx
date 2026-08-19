import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatDate, formatToman } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminPaymentsPage() {
  await requireAdmin("PAYMENTS_READ");
  const payments = await adminQueries.paymentsNeedingReview();
  return (
    <>
      <AdminPageHeader
        eyebrow="کنترل مالی"
        title="پرداخت‌های نیازمند بررسی"
        copy="رسید فقط مدرک ادعاست؛ تا زمان تأیید مالی، مبلغ به سفارش منظور نمی‌شود."
      />
      {payments.length === 0 ? (
        <AdminEmptyState>پرداختی در انتظار بررسی نیست.</AdminEmptyState>
      ) : (
        <div className="admin-list">
          {payments.map((payment) => (
            <article key={payment.id}>
              <div>
                <strong dir="ltr">{payment.orderNumber}</strong>
                <span>
                  {payment.customerName ??
                    payment.customerEmail ??
                    "مشتری بدون نام"}
                </span>
              </div>
              <div>
                <span className="admin-status">در انتظار بررسی</span>
                <small>
                  {payment.receiptId ? "رسید ثبت شده" : "رسید ثبت نشده"}
                </small>
              </div>
              <div>
                <strong>{formatToman(payment.amountToman)} تومان</strong>
                <small>{formatDate(payment.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
