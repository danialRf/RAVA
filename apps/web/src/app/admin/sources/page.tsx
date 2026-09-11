import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { updateRetailerAction } from "../actions";

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("SOURCES_READ");
  const [sources, q] = await Promise.all([
    adminQueries.sources(),
    searchParams,
  ]);
  const writable = ["OWNER", "ADMIN", "MERCHANDISER"].includes(user.role);
  return (
    <>
      <AdminPageHeader
        eyebrow="منابع"
        title="فروشگاه‌ها و سیاست اعتماد"
        copy="فعال‌سازی خزیدن به‌تنهایی منبع را تأیید نمی‌کند؛ سطح اعتماد و سلامت جدا ثبت می‌شوند."
      />
      <AdminNotice title="سیاست منبع، نه ادعای اصالت" tone="warning">
        سطح اعتماد، اجازه خزیدن و سلامت ثبت‌شده مستقل‌اند. تغییر آن‌ها در مسیر
        ممیزی باقی می‌ماند.
      </AdminNotice>
      <AdminFlash notice={q.notice} error={q.error} />
      <AdminStatGrid>
        <AdminStat
          label="منابع ثبت‌شده"
          value={sources.length.toLocaleString("fa-IR")}
          hint="فروشگاه‌ها و سیاست‌های آن‌ها"
        />
        <AdminStat
          label="خزیدن فعال"
          value={sources
            .filter((source) => source.isEnabled)
            .length.toLocaleString("fa-IR")}
          tone="info"
          hint="با رعایت سیاست منبع"
        />
      </AdminStatGrid>
      {sources.length === 0 ? (
        <AdminEmptyState>منبعی ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {sources.map((s) => (
            <details className="admin-record" key={s.id}>
              <summary>
                <span>
                  <strong>{s.name}</strong>
                  <small dir="ltr">{s.domain}</small>
                </span>
                <AdminEntityStatus status={s.trustTier} />
                <span>{s.offerCount} پیشنهاد</span>
                <AdminEntityStatus status={s.lastHealthStatus} />
              </summary>
              <form action={updateRetailerAction} className="admin-form-grid">
                <input type="hidden" name="id" value={s.id} />
                <label>
                  سطح اعتماد
                  <select name="trustTier" defaultValue={s.trustTier}>
                    {[
                      "OFFICIAL_BRAND",
                      "AUTHORIZED_RETAILER",
                      "TRUSTED_MARKETPLACE",
                      "UNVERIFIED",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  فاصله بررسی (دقیقه)
                  <input
                    name="defaultIntervalMinutes"
                    type="number"
                    min="5"
                    defaultValue={s.defaultIntervalMinutes}
                  />
                </label>
                <label className="consent">
                  <input
                    name="isEnabled"
                    type="checkbox"
                    defaultChecked={s.isEnabled}
                  />{" "}
                  خزیدن مجاز است
                </label>
                <label className="wide">
                  یادداشت شرایط استفاده
                  <input name="termsNotes" defaultValue={s.termsNotes ?? ""} />
                </label>
                <button disabled={!writable}>ذخیره سیاست</button>
              </form>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
