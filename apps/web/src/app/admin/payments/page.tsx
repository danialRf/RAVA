import { hasAdminPermission } from "@rava/domain";
import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatDate, formatToman } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { reviewCardPaymentAction } from "../actions";

export default async function AdminPaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  const user = await requireAdmin("PAYMENTS_READ");
  const params = await searchParams;
  const payments = await adminQueries.paymentsNeedingReview();
  return (
    <>
      <AdminPageHeader
        eyebrow="کنترل مالی"
        title="پرداخت‌های نیازمند بررسی"
        copy="رسید فقط مدرک ادعاست؛ تا زمان تأیید مالی، مبلغ به سفارش منظور نمی‌شود."
      />
      {params.notice && (
        <p className="admin-feedback success">{String(params.notice)}</p>
      )}
      {params.error && (
        <p className="admin-feedback error" role="alert">
          {String(params.error)}
        </p>
      )}
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
                {payment.receiptId && (
                  <Link
                    className="admin-receipt-link"
                    href={`/admin/payments/receipt/${payment.receiptId}`}
                    target="_blank"
                  >
                    مشاهده امن رسید
                  </Link>
                )}
              </div>
              <div>
                <strong>{formatToman(payment.amountToman)} تومان</strong>
                <small>{formatDate(payment.createdAt)}</small>
              </div>
              {hasAdminPermission(user.role, "PAYMENTS_REVIEW") && (
                <form
                  className="admin-review-form"
                  action={reviewCardPaymentAction}
                >
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <label>
                    دلیل تصمیم
                    <input
                      name="reason"
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder="مثلاً مبلغ و شماره پیگیری تطبیق داده شد"
                    />
                  </label>
                  <div>
                    <button
                      name="decision"
                      value="APPROVE"
                      className="button primary"
                    >
                      تأیید پرداخت
                    </button>
                    <button
                      name="decision"
                      value="REJECT"
                      className="button danger"
                    >
                      رد پرداخت
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
