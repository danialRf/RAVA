import Link from "next/link";
import { loadEnvironment } from "@rava/config";
import {
  listAddresses,
  listAlerts,
  listProductRequests,
  listWishlistProducts,
} from "@rava/db";
import { AccountNav, FormMessage } from "../../components/account";
import { PageIntro } from "../../components/storefront";
import { currentUser } from "../../server/auth";
import { database } from "../../server/db";
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
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : undefined;
  const notice = typeof query.notice === "string" ? query.notice : undefined;
  if (!user) {
    const environment = loadEnvironment();
    const googleEnabled = Boolean(
      environment.AUTH_GOOGLE_ID && environment.AUTH_GOOGLE_SECRET,
    );
    return (
      <div className="section-shell account-page">
        <PageIntro
          eyebrow="فضای شخصی شما"
          title="حساب من"
          copy="سفارش‌ها، علاقه‌مندی‌ها و درخواست‌هایتان را در یک جای امن نگه دارید."
        />
        <FormMessage error={error} notice={notice} />
        <div className="account-entry">
          <section>
            <h2>قبلاً حساب ساخته‌اید؟</h2>
            <p>با ایمیل و گذرواژه یا شماره موبایل وارد شوید.</p>
            <Link className="button primary" href="/account/login">
              ورود با ایمیل
            </Link>
            <Link className="button secondary" href="/account/otp">
              ورود با کد موبایل
            </Link>
          </section>
          <section>
            <h2>اولین بار است؟</h2>
            <p>ساخت حساب کمتر از یک دقیقه زمان می‌برد.</p>
            <Link className="button secondary" href="/account/register">
              ساخت حساب
            </Link>
            <span className="provider-divider">یا</span>
            {googleEnabled ? (
              <Link className="button secondary" href="/api/auth/google">
                ورود با Google
              </Link>
            ) : (
              <button
                className="button secondary"
                disabled
                title="شناسه Google تنظیم نشده است"
              >
                Google · فعلاً غیرفعال
              </button>
            )}
          </section>
        </div>
      </div>
    );
  }
  const [addresses, alerts, requests, wishlist] = await Promise.all([
    listAddresses(database(), user.id),
    listAlerts(database(), user.id),
    listProductRequests(database(), user.id),
    listWishlistProducts(database(), user.id),
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
