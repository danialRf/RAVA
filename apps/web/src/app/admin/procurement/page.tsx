import { formatEurCents, hasAdminPermission } from "@rava/domain";
import Link from "next/link";

import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatDate } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { updateProcurementAction } from "../actions";

function formatEuroCents(value: bigint | null): string {
  if (value === null) return "سقف خرید ثبت نشده";
  return `${formatEurCents(value)} €`;
}

export default async function AdminProcurementPage({
  searchParams,
}: PageProps<"/admin/procurement">) {
  const user = await requireAdmin("PROCUREMENT_READ");
  const params = await searchParams;
  const items = await adminQueries.procurementQueue();
  return (
    <>
      <AdminPageHeader
        eyebrow="خرید آلمان"
        title="صف تدارکات"
        copy="هر ردیف از یک سفارش پرداخت‌شده ساخته شده است؛ مبلغ واقعی و رسید خرید، وضعیت مشتری را به‌روزرسانی می‌کند."
      />
      <p className="admin-queue-note">
        قلم جدید از این صفحه اضافه نمی‌شود؛ صف فقط از سفارش قطعی و دارای
        پیش‌پرداخت ساخته می‌شود تا کالای بدون سفارش وارد عملیات نشود.
      </p>
      {params.notice && (
        <p className="admin-feedback success">{String(params.notice)}</p>
      )}
      {params.error && (
        <p className="admin-feedback error" role="alert">
          {String(params.error)}
        </p>
      )}
      {items.length === 0 ? (
        <AdminEmptyState>کالایی در صف تهیه نیست.</AdminEmptyState>
      ) : (
        <div className="procurement-grid">
          {items.map((item) => (
            <article key={item.id}>
              <span className="admin-status" dir="ltr">
                {item.procurementStatus}
              </span>
              <h2>{item.productSnapshot.titleFa}</h2>
              <p dir="ltr">
                {item.productSnapshot.brand} ·{" "}
                {item.productSnapshot.titleOriginal}
              </p>
              <dl>
                <div>
                  <dt>سفارش</dt>
                  <dd>
                    <Link href={`/admin/orders/${item.orderId}`} dir="ltr">
                      {item.orderNumber}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>تعداد</dt>
                  <dd>{item.quantity.toLocaleString("fa-IR")}</dd>
                </div>
                <div>
                  <dt>سقف خرید</dt>
                  <dd dir="ltr">
                    {formatEuroCents(item.maxSourcePriceEurCents)}
                  </dd>
                </div>
                <div>
                  <dt>ورود به صف</dt>
                  <dd>{formatDate(item.createdAt)}</dd>
                </div>
              </dl>
              <a
                href={item.offerSnapshot.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                بازکردن منبع خرید
              </a>
              {hasAdminPermission(user.role, "PROCUREMENT_WRITE") &&
                item.taskStatus && (
                  <form
                    className="procurement-actions"
                    action={updateProcurementAction}
                  >
                    <input type="hidden" name="orderItemId" value={item.id} />
                    {item.taskStatus === "OPEN" && (
                      <button
                        className="button primary"
                        name="action"
                        value="ASSIGN_TO_SELF"
                      >
                        اختصاص به من
                      </button>
                    )}
                    {item.taskStatus === "ASSIGNED" &&
                      item.assignedToUserId === user.id && (
                        <button
                          className="button primary"
                          name="action"
                          value="START"
                        >
                          شروع خرید
                        </button>
                      )}
                    {item.procurementStatus === "ASSIGNED" &&
                      item.assignedToUserId === user.id && (
                        <details>
                          <summary>کالا موجود نیست</summary>
                          <label>
                            دلیل
                            <input
                              name="reason"
                              minLength={3}
                              maxLength={500}
                            />
                          </label>
                          <button
                            className="button danger"
                            name="action"
                            value="MARK_UNAVAILABLE"
                          >
                            ثبت عدم موجودی
                          </button>
                        </details>
                      )}
                    {item.taskStatus === "IN_PROGRESS" &&
                      item.assignedToUserId === user.id && (
                        <details className="purchase-completion">
                          <summary>خرید انجام شد</summary>
                          <p>
                            مبلغ واقعی کالا و تصویر رسید را ثبت کنید. مبلغ کالا
                            نباید از سقف قفل‌شده بیشتر باشد.
                          </p>
                          <div className="admin-money-fields">
                            <label>
                              مبلغ واقعی کالا (یورو)
                              <input
                                name="purchaseEur"
                                inputMode="decimal"
                                placeholder="مثلاً 24.95"
                                required
                              />
                            </label>
                            <label>
                              هزینه ارسال داخل آلمان (یورو)
                              <input
                                name="shippingEur"
                                inputMode="decimal"
                                defaultValue="0"
                                required
                              />
                            </label>
                          </div>
                          <label>
                            شماره سفارش فروشگاه (اختیاری)
                            <input name="retailerOrderRef" maxLength={120} />
                          </label>
                          <label>
                            تصویر رسید خرید
                            <input
                              name="receipt"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              required
                            />
                          </label>
                          <button
                            className="button primary"
                            name="action"
                            value="COMPLETE_PURCHASE"
                          >
                            ثبت خرید و اطلاع به مشتری
                          </button>
                        </details>
                      )}
                  </form>
                )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
