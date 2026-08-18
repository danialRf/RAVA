import { redirect } from "next/navigation";
import { AccountNav, FormMessage } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { currentUser } from "../../../server/auth";
import { updateProfileAction } from "../manage-actions";

export default async function ProfilePage({
  searchParams,
}: PageProps<"/account/profile">) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const q = await searchParams;
  return (
    <div className="section-shell account-page">
      <PageIntro
        eyebrow="حساب من"
        title="پروفایل"
        copy="اطلاعات پایه و راه‌های ورود تأییدشده."
      />
      <AccountNav />
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <section className="account-form-section">
        <form action={updateProfileAction} className="auth-form">
          <label>
            نام نمایشی
            <input
              name="displayName"
              defaultValue={user.displayName ?? ""}
              maxLength={80}
              required
            />
          </label>
          <button className="button primary">ذخیره تغییرات</button>
        </form>
        <dl className="identity-list">
          <div>
            <dt>ایمیل</dt>
            <dd dir="ltr">{user.email ?? "متصل نیست"}</dd>
          </div>
          <div>
            <dt>وضعیت ایمیل</dt>
            <dd>{user.emailVerifiedAt ? "تأییدشده" : "نیازمند تأیید"}</dd>
          </div>
          <div>
            <dt>موبایل</dt>
            <dd dir="ltr">{user.phoneE164 ?? "متصل نیست"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
