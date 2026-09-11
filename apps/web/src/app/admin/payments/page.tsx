import { hasAdminPermission } from "@rava/domain";
import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminDataTable,
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
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
      <AdminFlash notice={params.notice} error={params.error} />
      <AdminNotice title="کنترل دو مرحله‌ای پرداخت" tone="warning">
        تأیید یا رد پرداخت فقط با دلیل ثبت‌شده انجام می‌شود و در سابقه ممیزی
        باقی می‌ماند.
      </AdminNotice>
      <AdminStatGrid>
        <AdminStat
          label="صف بررسی"
          value={payments.length.toLocaleString("fa-IR")}
          hint="رسیدهای منتظر تصمیم"
          tone={payments.length ? "warning" : "success"}
        />
      </AdminStatGrid>
      {payments.length === 0 ? (
        <AdminEmptyState>پرداختی در انتظار بررسی نیست.</AdminEmptyState>
      ) : (
        <AdminDataTable
          caption="پرداخت‌های نیازمند بررسی"
          columns={[
            { key: "order", label: "سفارش" },
            { key: "customer", label: "مشتری" },
            { key: "type", label: "نوع و رسید" },
            { key: "amount", label: "مبلغ", align: "end" },
            { key: "action", label: "تصمیم" },
          ]}
          rows={payments.map((payment) => ({
            id: payment.id,
            cells: {
              order: <strong dir="ltr">{payment.orderNumber}</strong>,
              customer:
                payment.customerName ??
                payment.customerEmail ??
                "مشتری بدون نام",
              type: (
                <>
                  <AdminEntityStatus status="PENDING_VERIFICATION">
                    {payment.type === "BALANCE" ? "تسویه مانده" : "پیش‌پرداخت"}
                  </AdminEntityStatus>
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
                </>
              ),
              amount: (
                <>
                  <strong>{formatToman(payment.amountToman)} تومان</strong>
                  <small>{formatDate(payment.createdAt)}</small>
                </>
              ),
              action: hasAdminPermission(user.role, "PAYMENTS_REVIEW") ? (
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
                      تأیید
                    </button>
                    <button
                      name="decision"
                      value="REJECT"
                      className="button danger"
                    >
                      رد
                    </button>
                  </div>
                </form>
              ) : (
                "فقط مشاهده"
              ),
            },
          }))}
        />
      )}
    </>
  );
}
