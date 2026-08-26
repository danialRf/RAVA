import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { updateProductAction } from "../actions";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("CATALOG_READ");
  const [items, query] = await Promise.all([
    adminQueries.catalog(),
    searchParams,
  ]);
  return (
    <>
      <AdminPageHeader
        eyebrow="کاتالوگ"
        title="محصولات و وضعیت انتشار"
        copy="فقط واقعیت‌های ثبت‌شده را ویرایش کنید؛ اطلاعات نامعلوم باید خالی بماند."
      />
      {query.notice && <p className="admin-flash success">{query.notice}</p>}
      {query.error && <p className="admin-flash error">{query.error}</p>}
      {items.length === 0 ? (
        <AdminEmptyState>هنوز محصولی ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {items.map((item) => (
            <details className="admin-record" key={item.id}>
              <summary>
                <span>
                  <strong>{item.titleFa}</strong>
                  <small dir="ltr">{item.titleOriginal}</small>
                </span>
                <span>
                  {item.brandName} · {item.categoryName}
                </span>
                <span>
                  {item.variantCount} تنوع · {item.offerCount} پیشنهاد
                </span>
                <mark>{item.status}</mark>
              </summary>
              <form action={updateProductAction} className="admin-form-grid">
                <input type="hidden" name="id" value={item.id} />
                <label>
                  عنوان فارسی
                  <input
                    name="titleFa"
                    defaultValue={item.titleFa}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  وزن (گرم)
                  <input
                    name="weightGrams"
                    type="number"
                    min="1"
                    defaultValue={item.weightGrams ?? ""}
                  />
                </label>
                <label>
                  کلاس حمل
                  <select
                    name="transportClass"
                    defaultValue={item.transportClass ?? ""}
                  >
                    <option value="">نامعلوم</option>
                    {["XS", "S", "M", "L", "BLOCKED"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  وضعیت
                  <select name="status" defaultValue={item.status}>
                    {["DRAFT", "NEEDS_REVIEW", "PUBLISHED", "ARCHIVED"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="wide">
                  توضیح فارسی
                  <textarea
                    name="descriptionFa"
                    rows={4}
                    defaultValue={item.descriptionFa ?? ""}
                  />
                </label>
                <button
                  disabled={
                    !user ||
                    !["OWNER", "ADMIN", "MERCHANDISER"].includes(user.role)
                  }
                >
                  ذخیره محصول
                </button>
              </form>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
