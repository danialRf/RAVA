import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { AdminEntityStatus } from "../../../lib/admin-status";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { createContentAction, updateContentStatusAction } from "../actions";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("CONTENT_READ");
  const [entries, q] = await Promise.all([
    adminQueries.content(),
    searchParams,
  ]);
  const writable = ["OWNER", "ADMIN", "CONTENT_EDITOR"].includes(user.role);
  return (
    <>
      <AdminPageHeader
        eyebrow="محتوا"
        title="پیش‌نویس، بازبینی و انتشار"
        copy="محتوا نسخه‌دار است و هیچ متن تولیدشده‌ای بدون اقدام صریح اپراتور منتشر نمی‌شود."
      />
      <AdminNotice title="انتشار صریح و ممیزی‌شده" tone="info">
        پیش‌نویس به‌تنهایی منتشر نمی‌شود؛ هر تغییر وضعیت با نقش مجاز و اقدام
        صریح اپراتور انجام می‌شود.
      </AdminNotice>
      <AdminFlash notice={q.notice} error={q.error} />
      <AdminStatGrid>
        <AdminStat
          label="رکوردهای محتوا"
          value={entries.length.toLocaleString("fa-IR")}
          hint="پیش‌نویس، زمان‌بندی و انتشار"
        />
      </AdminStatGrid>
      {writable && (
        <details className="admin-create-panel">
          <summary>ساخت پیش‌نویس</summary>
          <form action={createContentAction} className="admin-form-grid">
            <label>
              کلید لاتین
              <input name="key" dir="ltr" required />
            </label>
            <label>
              عنوان
              <input name="title" />
            </label>
            <label className="wide">
              متن
              <textarea name="bodyText" rows={6} required />
            </label>
            <button>ثبت پیش‌نویس</button>
          </form>
        </details>
      )}
      {entries.length === 0 ? (
        <AdminEmptyState>محتوایی ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {entries.map((e) => (
            <article className="admin-record static" key={e.id}>
              <div>
                <strong>{e.title ?? e.key}</strong>
                <small dir="ltr">
                  {e.key} · v{e.version}
                </small>
              </div>
              <AdminEntityStatus status={e.status} />
              <form action={updateContentStatusAction}>
                <input type="hidden" name="id" value={e.id} />
                <select name="status" defaultValue={e.status}>
                  {["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].map((v) => (
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
