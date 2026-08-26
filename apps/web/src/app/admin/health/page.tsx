import { AdminPageHeader } from "../../../components/admin";
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
      <section className="admin-metrics">
        <div>
          <span>Job ناموفق</span>
          <strong>{formatCount(health.failedJobs)}</strong>
        </div>
        <div>
          <span>Outbox معطل/ناموفق</span>
          <strong>{formatCount(health.pendingOutbox)}</strong>
        </div>
        <div>
          <span>Scraper ناقص/ناموفق</span>
          <strong>{formatCount(health.failedScrapers)}</strong>
        </div>
        <div>
          <span>آخرین نرخ ارز</span>
          <strong>
            {health.latestFx
              ? health.latestFx.tomanPerUnit.toLocaleString("fa-IR")
              : "نامعلوم"}
          </strong>
          <small>{health.latestFx?.provider ?? "Provider ثبت نشده"}</small>
        </div>
      </section>
      <section className="admin-record-list">
        {health.retailers.map((s) => (
          <article className="admin-record static" key={s.id}>
            <strong>{s.name}</strong>
            <span>{s.lastHealthStatus ?? "سلامت ثبت نشده"}</span>
            <small>
              {s.lastHealthAt
                ? s.lastHealthAt.toLocaleString("fa-IR")
                : "زمان بررسی نامعلوم"}
            </small>
          </article>
        ))}
      </section>
    </>
  );
}
