import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
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
      {q.notice && <p className="admin-flash success">{q.notice}</p>}
      {q.error && <p className="admin-flash error">{q.error}</p>}
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
            </article>
          ))}
        </section>
      )}
    </>
  );
}
