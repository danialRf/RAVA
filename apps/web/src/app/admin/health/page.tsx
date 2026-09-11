import { AdminPageHeader } from "../../../components/admin";
import {
  AdminDataTable,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { formatCount } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";

export default async function AdminHealthPage() {
  await requireAdmin("HEALTH_READ");
  const health = await adminQueries.health();
  return (
    <>
      <AdminPageHeader
        eyebrow="سلامت عملیات"
        title="Providerها، صف‌ها و استخراج"
        copy="این صفحه فقط وضعیت ثبت‌شده را گزارش می‌کند و هیچ سلامت فرضی تولید نمی‌کند."
      />
      <AdminNotice title="نمای وضعیت، نه فرمان اجرا" tone="info">
        این صفحه تنها مشاهده‌پذیری ثبت‌شده را ارائه می‌کند و هیچ سرویس، صف یا
        خزنده‌ای را از رابط کاربری اجرا نمی‌کند.
      </AdminNotice>
      <AdminStatGrid>
        <AdminStat
          label="Job ناموفق"
          value={formatCount(health.failedJobs)}
          tone={health.failedJobs ? "danger" : "success"}
        />
        <AdminStat
          label="Outbox معطل/ناموفق"
          value={formatCount(health.pendingOutbox)}
          tone={health.pendingOutbox ? "warning" : "success"}
        />
        <AdminStat
          label="Scraper ناقص/ناموفق"
          value={formatCount(health.failedScrapers)}
          tone={health.failedScrapers ? "warning" : "success"}
        />
        <AdminStat
          label="آخرین نرخ ارز"
          value={
            health.latestFx
              ? health.latestFx.tomanPerUnit.toLocaleString("fa-IR")
              : "نامعلوم"
          }
          hint={health.latestFx?.provider ?? "Provider ثبت نشده"}
        />
      </AdminStatGrid>
      <AdminDataTable
        caption="سلامت ثبت‌شده فروشگاه‌ها"
        columns={[
          { key: "source", label: "منبع" },
          { key: "health", label: "سلامت" },
          { key: "checked", label: "آخرین بررسی" },
        ]}
        rows={health.retailers.map((source) => ({
          id: source.id,
          cells: {
            source: source.name,
            health: <AdminEntityStatus status={source.lastHealthStatus} />,
            checked: source.lastHealthAt
              ? source.lastHealthAt.toLocaleString("fa-IR")
              : "زمان بررسی نامعلوم",
          },
        }))}
      />
    </>
  );
}
