import { redirect } from "next/navigation";
import { AccountNav, FormMessage } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { currentUser } from "../../../server/auth";
import { accountQueries } from "../../../server/account";
import { updatePreferencesAction } from "../manage-actions";

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/account/notifications">) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [items, q] = await Promise.all([
    accountQueries.notificationPreferences(user.id),
    searchParams,
  ]);
  const enabled = (channel: string) =>
    items.find((i) => i.channel === channel && i.topic === "ORDER_UPDATES")
      ?.isEnabled ?? channel === "IN_APP";
  return (
    <div className="section-shell account-page">
      <PageIntro
        eyebrow="حساب من"
        title="اطلاع‌رسانی"
        copy="انتخاب کنید تغییرهای مهم سفارش از چه راهی اعلام شوند."
      />
      <AccountNav />
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <section className="account-form-section narrow">
        <form action={updatePreferencesAction} className="preference-form">
          <label>
            <input
              type="checkbox"
              name="IN_APP"
              defaultChecked={enabled("IN_APP")}
            />
            <span>
              <strong>داخل حساب</strong>
              <small>برای رویدادهای مهم همیشه پیشنهاد می‌شود.</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              name="EMAIL"
              defaultChecked={enabled("EMAIL")}
              disabled={!user.emailVerifiedAt}
            />
            <span>
              <strong>ایمیل</strong>
              <small>
                {user.emailVerifiedAt
                  ? "به ایمیل تأییدشده ارسال می‌شود."
                  : "ابتدا ایمیل را تأیید کنید."}
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              name="SMS"
              defaultChecked={enabled("SMS")}
              disabled={!user.phoneVerifiedAt}
            />
            <span>
              <strong>پیامک</strong>
              <small>
                {user.phoneVerifiedAt
                  ? "به شماره تأییدشده ارسال می‌شود."
                  : "ابتدا شماره موبایل را متصل کنید."}
              </small>
            </span>
          </label>
          <button className="button primary">ذخیره ترجیحات</button>
        </form>
      </section>
    </div>
  );
}
