import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { formatDate } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminAuditPage() {
  await requireAdmin("AUDIT_READ");
  const events = await adminQueries.auditLog();
  return (
    <>
      <AdminPageHeader
        eyebrow="ردپای تغییرات حساس"
        title="گزارش ممیزی"
        copy="این فهرست append-only است و فقط رویدادهای ثبت‌شده را نشان می‌دهد."
      />
      {events.length === 0 ? (
        <AdminEmptyState>هنوز رویداد مدیریتی ثبت نشده است.</AdminEmptyState>
      ) : (
        <div className="admin-list">
          {events.map((event) => (
            <article key={event.id}>
              <div>
                <strong dir="ltr">{event.action}</strong>
                <span>{event.actorName ?? event.actorEmail ?? "سیستم"}</span>
              </div>
              <div>
                <span>{event.entityType}</span>
                <small dir="ltr">{event.entityId ?? "—"}</small>
              </div>
              <small>{formatDate(event.createdAt)}</small>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
