import { AdminEmptyState, AdminPageHeader } from "../../../components/admin";
import {
  AdminFlash,
  AdminNotice,
  AdminStat,
  AdminStatGrid,
} from "../../../components/admin-ui";
import { formatToman } from "../../../lib/format";
import { adminQueries, requireAdmin } from "../../../server/admin";
import { createPricingRuleAction } from "../actions";

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireAdmin("PRICING_READ");
  const [rules, query] = await Promise.all([
    adminQueries.pricing(),
    searchParams,
  ]);
  const writable = ["OWNER", "ADMIN"].includes(user.role);
  return (
    <>
      <AdminPageHeader
        eyebrow="قیمت‌گذاری"
        title="عامل‌های شفاف قیمت نهایی"
        copy="نرخ ارز از Provider می‌آید و در این فرم قابل دستکاری نیست؛ هر قانون جدید ممیزی می‌شود."
      />
      <AdminNotice title="قیمت قطعیِ قابل ردگیری" tone="warning">
        قانون جدید فقط بر محاسبات جدید اثر می‌گذارد؛ نقل‌قول‌ها و سفارش‌های
        قفل‌شده با snapshot خود باقی می‌مانند.
      </AdminNotice>
      <AdminFlash notice={query.notice} error={query.error} />
      <AdminStatGrid>
        <AdminStat
          label="قانون فعال/ثبت‌شده"
          value={rules.length.toLocaleString("fa-IR")}
          hint="اولویت و دامنه در هر ردیف مشخص است"
        />
      </AdminStatGrid>
      {writable && (
        <details className="admin-create-panel">
          <summary>افزودن قانون سراسری</summary>
          <form action={createPricingRuleAction} className="admin-form-grid">
            <label>
              اولویت
              <input
                name="priority"
                type="number"
                min="0"
                defaultValue="100"
                required
              />
            </label>
            <label>
              حاشیه (basis points)
              <input
                name="targetMarginBps"
                type="number"
                min="0"
                max="9999"
                required
              />
            </label>
            <label>
              حداقل سود تومان
              <input name="minProfitToman" inputMode="numeric" required />
            </label>
            <label>
              کلاس حمل
              <select name="transportClass">
                {["XS", "S", "M", "L", "BLOCKED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              ریسک گمرک
              <input
                name="customsRiskBps"
                type="number"
                min="0"
                defaultValue="0"
              />
            </label>
            <label>
              بافر ارز
              <input
                name="fxBufferBps"
                type="number"
                min="0"
                defaultValue="0"
              />
            </label>
            <label>
              کارمزد پرداخت
              <input
                name="paymentFeeBps"
                type="number"
                min="0"
                defaultValue="0"
              />
            </label>
            <label>
              درصد پیش‌پرداخت
              <input
                name="depositBps"
                type="number"
                min="1"
                max="10000"
                required
              />
            </label>
            <label>
              حداقل پیش‌پرداخت
              <input name="minDepositToman" defaultValue="0" />
            </label>
            <label>
              واحد گردکردن
              <input name="roundingUnitToman" defaultValue="10000" />
            </label>
            <label className="wide">
              یادداشت
              <input name="notes" />
            </label>
            <button>ثبت قانون</button>
          </form>
        </details>
      )}
      {rules.length === 0 ? (
        <AdminEmptyState>قانون قیمت‌گذاری ثبت نشده است.</AdminEmptyState>
      ) : (
        <section className="admin-record-list">
          {rules.map((r) => (
            <article className="admin-record static" key={r.id}>
              <strong>
                {r.scope} · {r.transportClass}
              </strong>
              <span>
                حاشیه {r.targetMarginBps / 100}٪ · پیش‌پرداخت{" "}
                {r.depositBps / 100}٪
              </span>
              <span>حداقل سود {formatToman(r.minProfitToman)} تومان</span>
              <small>{r.notes ?? "بدون یادداشت"}</small>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
