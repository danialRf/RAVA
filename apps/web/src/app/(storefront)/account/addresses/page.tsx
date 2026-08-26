import { redirect } from "next/navigation";
import { AccountNav, FormMessage } from "../../../../components/account";
import { PageIntro } from "../../../../components/storefront";
import { currentUser } from "../../../../server/auth";
import { accountQueries } from "../../../../server/account";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "../manage-actions";

export default async function AddressesPage({
  searchParams,
}: PageProps<"/account/addresses">) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [items, q] = await Promise.all([
    accountQueries.addresses(user.id),
    searchParams,
  ]);
  return (
    <div className="section-shell account-page">
      <PageIntro
        eyebrow="حساب من"
        title="نشانی‌های تحویل"
        copy="نشانی‌ها خصوصی‌اند و فقط برای سفارش‌های خودتان استفاده می‌شوند."
      />
      <AccountNav />
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <div className="address-layout">
        <section>
          <h2>نشانی‌های ذخیره‌شده</h2>
          {items.length === 0 ? (
            <p className="muted">هنوز نشانی ثبت نشده است.</p>
          ) : (
            <div className="address-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.recipientName}</strong>
                    {item.isDefault && <span>پیش‌فرض</span>}
                    <p>
                      {item.province}، {item.city}، {item.addressLine}
                    </p>
                    <small dir="ltr">{item.phoneE164}</small>
                  </div>
                  <div className="inline-actions">
                    {!item.isDefault && (
                      <form action={setDefaultAddressAction}>
                        <input type="hidden" name="addressId" value={item.id} />
                        <button>پیش‌فرض شود</button>
                      </form>
                    )}
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="addressId" value={item.id} />
                      <button className="danger">حذف</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="account-form-section">
          <h2>افزودن نشانی</h2>
          <form action={createAddressAction} className="auth-form">
            <label>
              نام گیرنده
              <input name="recipientName" required />
            </label>
            <label>
              شماره تماس
              <input name="phone" dir="ltr" inputMode="tel" required />
            </label>
            <div className="field-row">
              <label>
                استان
                <input name="province" required />
              </label>
              <label>
                شهر
                <input name="city" required />
              </label>
            </div>
            <label>
              نشانی کامل
              <textarea name="addressLine" rows={3} required />
            </label>
            <label>
              کد پستی
              <input
                name="postalCode"
                dir="ltr"
                inputMode="numeric"
                pattern="[0-9]{10}"
              />
            </label>
            <label className="check-row">
              <input type="checkbox" name="isDefault" />
              نشانی پیش‌فرض
            </label>
            <button className="button primary">ذخیره نشانی</button>
          </form>
        </section>
      </div>
    </div>
  );
}
