import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import {
  archiveRetailerAction,
  createRetailerAction,
  updateRetailerAction,
} from "../actions";

const TRUST_TIERS = [
  "OFFICIAL_BRAND",
  "AUTHORIZED_RETAILER",
  "TRUSTED_MARKETPLACE",
  "UNVERIFIED",
] as const;

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
      {writable && (
        <details className="admin-create-panel">
          <summary>+ افزودن فروشگاه آلمانی</summary>
          <form action={createRetailerAction} className="admin-form-grid">
            <label>
              نام فروشگاه
              <input name="name" required minLength={2} maxLength={160} />
            </label>
            <label>
              دامنه سایت
              <input
                name="domain"
                dir="ltr"
                required
                placeholder="example.de"
              />
            </label>
            <label>
              سطح اعتماد
              <select name="trustTier" defaultValue="UNVERIFIED">
                {TRUST_TIERS.map((tier) => (
                  <option value={tier} key={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
            <label>
              فاصله بررسی (دقیقه)
              <input
                name="defaultIntervalMinutes"
                type="number"
                min="5"
                defaultValue="180"
                required
              />
            </label>
            <label className="consent">
              <input name="isEnabled" type="checkbox" /> فعال برای بررسی و فروش
            </label>
            <label className="wide">
              یادداشت سیاست و شرایط استفاده
              <input name="termsNotes" />
            </label>
            <button className="button primary">ثبت فروشگاه</button>
          </form>
        </details>
      )}
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
                <AdminEntityStatus
                  status={s.isEnabled ? "ACTIVE" : "INACTIVE"}
                />
                <span>{s.offerCount} پیشنهاد</span>
                <AdminEntityStatus status={s.lastHealthStatus} />
              </summary>
              <form action={updateRetailerAction} className="admin-form-grid">
                <input type="hidden" name="id" value={s.id} />
                <label>
                  نام فروشگاه
                  <input
                    name="name"
                    defaultValue={s.name}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </label>
                <label>
                  دامنه سایت
                  <input
                    name="domain"
                    dir="ltr"
                    defaultValue={s.domain}
                    required
                  />
                </label>
                <label>
                  سطح اعتماد
                  <select name="trustTier" defaultValue={s.trustTier}>
                    {TRUST_TIERS.map((v) => (
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
              {writable && s.isEnabled && (
                <form
                  action={archiveRetailerAction}
                  className="admin-danger-zone"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <p>
                    غیرفعال‌سازی، فروشگاه و تمام لینک‌های خرید آن را بدون حذف
                    تاریخچه از فروش خارج می‌کند.
                  </p>
                  <button className="button danger">
                    غیرفعال و آرشیو کردن
                  </button>
                </form>
              )}
            </details>
          ))}
        </section>
      )}
    </>
  );
}
