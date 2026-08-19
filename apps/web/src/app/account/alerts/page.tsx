import { redirect } from "next/navigation";
import { formatToman } from "../../../lib/format";
import { AccountNav, FormMessage } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { currentUser } from "../../../server/auth";
import { accountQueries } from "../../../server/account";
import {
  cancelPriceAlertAction,
  createPriceAlertAction,
} from "../manage-actions";

export default async function AlertsPage({
  searchParams,
}: PageProps<"/account/alerts">) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [items, q] = await Promise.all([
    accountQueries.alerts(user.id),
    searchParams,
  ]);
  return (
    <div className="section-shell account-page">
      <PageIntro
        eyebrow="حساب من"
        title="هشدارهای قیمت"
        copy="وقتی قیمت تخمینی به مبلغ هدف برسد، هشدار فعال قابل پردازش است."
      />
      <AccountNav />
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <div className="account-two-column">
        <section>
          <h2>هشدارهای شما</h2>
          {items.length === 0 ? (
            <p className="muted">هشدار فعالی ندارید.</p>
          ) : (
            <div className="simple-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.productTitle}</strong>
                    <p>
                      هدف: {formatToman(item.thresholdToman)} تومان ·{" "}
                      {item.status === "ACTIVE" ? "فعال" : "بسته"}
                    </p>
                  </div>
                  {item.status === "ACTIVE" && (
                    <form action={cancelPriceAlertAction}>
                      <input type="hidden" name="alertId" value={item.id} />
                      <button className="danger">لغو</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="account-form-section">
          <h2>هشدار تازه</h2>
          <form action={createPriceAlertAction} className="auth-form">
            <label>
              شناسه محصول
              <input
                name="productSlug"
                dir="ltr"
                placeholder="adidas-samba-og"
                required
              />
            </label>
            <label>
              قیمت هدف (تومان)
              <input name="threshold" dir="ltr" inputMode="numeric" required />
            </label>
            <button className="button primary">ساخت هشدار</button>
          </form>
        </section>
      </div>
    </div>
  );
}
