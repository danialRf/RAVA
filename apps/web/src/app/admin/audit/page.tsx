import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminDataTable,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
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
      <AdminNotice title="ثبت فقط و غیرقابل‌ویرایش" tone="info">
        رویدادها از عملیات حساس ایجاد می‌شوند و این صفحه امکان تغییر یا حذف
        آن‌ها را ندارد.
      </AdminNotice>
      <AdminStatGrid>
        <AdminStat
          label="رویدادهای اخیر"
          value={events.length.toLocaleString("fa-IR")}
          hint="محدوده قابل مشاهده برای نقش شما"
        />
      </AdminStatGrid>
      {events.length === 0 ? (
        <AdminEmptyState>هنوز رویداد مدیریتی ثبت نشده است.</AdminEmptyState>
      ) : (
        <AdminDataTable
          caption="فهرست رویدادهای ممیزی"
          columns={[
            { key: "action", label: "عملیات" },
            { key: "actor", label: "انجام‌دهنده" },
            { key: "entity", label: "رکورد" },
            { key: "time", label: "زمان" },
          ]}
          rows={events.map((event) => ({
            id: event.id,
            cells: {
              action: <strong dir="ltr">{event.action}</strong>,
              actor: event.actorName ?? event.actorEmail ?? "سیستم",
              entity: (
                <>
                  <span>{event.entityType}</span>
                  <small dir="ltr">{event.entityId ?? "—"}</small>
                </>
              ),
              time: formatDate(event.createdAt),
            },
          }))}
        />
      )}
    </>
  );
}
