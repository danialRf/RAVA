import { formatEurCents, hasAdminPermission } from "@rava/domain";

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
        copy="برای استفاده خریدار در موبایل: کالا، منبع و سقف مجاز خرید در یک نگاه."
      />
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
                  <dd dir="ltr">{item.orderNumber}</dd>
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
                  </form>
                )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
