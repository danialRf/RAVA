import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountNav, FormMessage } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { currentUser } from "../../../server/auth";
import { accountQueries } from "../../../server/account";
import { logoutAction, resendVerificationAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "حساب من",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  const user = await currentUser();
  if (!user) {
    redirect("/account/login");
  }

  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const notice = typeof query.notice === "string" ? query.notice : undefined;
  const [addresses, alerts, requests, wishlist] = await Promise.all([
    accountQueries.addresses(user.id),
    accountQueries.alerts(user.id),
    accountQueries.productRequests(user.id),
    accountQueries.wishlist(user.id),
  ]);
  return (
    <div className="section-shell account-page">
      <PageIntro
        eyebrow="فضای شخصی شما"
        title={user.displayName ? `سلام ${user.displayName}` : "حساب من"}
        copy="وضعیت اطلاعات و انتخاب‌های شما در روا."
      />
      <FormMessage error={error} notice={notice} />
      <AccountNav />
      {user.email && !user.emailVerifiedAt && (
        <section className="account-banner">
          <div>
            <strong>ایمیل هنوز تأیید نشده است</strong>
            <p>
              برای بازیابی امن حساب، لینک تأیید را از سرویس ایمیل توسعه دریافت
              کنید.
            </p>
          </div>
          <form action={resendVerificationAction}>
            <button className="button secondary">ارسال دوباره</button>
          </form>
        </section>
      )}
      <div className="dashboard-stats">
        <Link href="/account/addresses">
          <strong>{addresses.length.toLocaleString("fa-IR")}</strong>
          <span>نشانی ذخیره‌شده</span>
        </Link>
        <Link href="/wishlist">
          <strong>{wishlist.length.toLocaleString("fa-IR")}</strong>
          <span>علاقه‌مندی</span>
        </Link>
        <Link href="/account/alerts">
          <strong>
            {alerts
              .filter((item) => item.status === "ACTIVE")
              .length.toLocaleString("fa-IR")}
          </strong>
          <span>هشدار فعال</span>
        </Link>
        <Link href="/find-it">
          <strong>{requests.length.toLocaleString("fa-IR")}</strong>
          <span>درخواست محصول</span>
        </Link>
      </div>
      <section className="account-security">
        <div>
          <h2>راه‌های ورود</h2>
          <p>{user.email ?? "ایمیل متصل نیست"}</p>
          <p dir="ltr">{user.phoneE164 ?? "شماره موبایل متصل نیست"}</p>
        </div>
        <form action={logoutAction}>
          <button className="button secondary">خروج امن از حساب</button>
        </form>
      </section>
    </div>
  );
}
