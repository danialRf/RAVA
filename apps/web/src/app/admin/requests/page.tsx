import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { formatToman } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { updateProductRequestAction } from "../actions";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("REQUESTS_READ");
  const [requests, q] = await Promise.all([
    adminQueries.productRequests(),
    searchParams,
  ]);
  const writable = ["OWNER", "ADMIN", "SUPPORT"].includes(user.role);
  return (
    <>
      <AdminPageHeader
        eyebrow="درخواست محصول"
        title="صف تحقیق و پاسخ به مشتری"
        copy="بودجه و لینک فقط داده مشتری‌اند؛ تا بررسی منبع، قیمت یا موجودی تأیید نمی‌شود."
      />
      <AdminNotice title="درخواست، تعهد قیمت نیست" tone="info">
        تا زمانی که منبع و قیمت بررسی نشده‌اند، بودجه و لینک صرفاً اطلاعات
        ارائه‌شده توسط مشتری هستند.
      </AdminNotice>
      <AdminFlash notice={q.notice} error={q.error} />
      <AdminStatGrid>
        <AdminStat
          label="درخواست‌های باز"
          value={requests
            .filter(
              (request) => !["FULFILLED", "DECLINED"].includes(request.status),
            )
            .length.toLocaleString("fa-IR")}
          tone="warning"
          hint="در انتظار پاسخ یا بررسی"
        />
      </AdminStatGrid>
      {requests.length === 0 ? (
        <AdminEmptyState>درخواست بازی وجود ندارد.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {requests.map((r) => (
            <article className="admin-record static" key={r.id}>
              <div>
                <strong>{r.descriptionFa}</strong>
                <small>{r.customerName ?? r.customerEmail ?? "مهمان"}</small>
              </div>
              <span>
                {r.budgetToman
                  ? `${formatToman(r.budgetToman)} تومان`
                  : "بودجه نامعلوم"}
              </span>
              {r.referenceUrl && (
                <a href={r.referenceUrl} target="_blank" rel="noreferrer">
                  مرجع مشتری
                </a>
              )}
              <form action={updateProductRequestAction}>
                <input type="hidden" name="id" value={r.id} />
                <select name="status" defaultValue={r.status}>
                  {[
                    "SUBMITTED",
                    "IN_RESEARCH",
                    "QUOTED",
                    "FULFILLED",
                    "DECLINED",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <button disabled={!writable}>ثبت وضعیت</button>
              </form>
              <AdminEntityStatus status={r.status} />
            </article>
          ))}
        </section>
      )}
    </>
  );
}
