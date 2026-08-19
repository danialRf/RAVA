import Link from "next/link";

export function FormMessage({
  error,
  notice,
}: {
  error?: string | undefined;
  notice?: string | undefined;
}) {
  if (!error && !notice) return null;
  return (
    <p
      className={`form-message ${error ? "error" : "notice"}`}
      role={error ? "alert" : "status"}
    >
      {error ?? notice}
    </p>
  );
}

export function AccountNav() {
  return (
    <nav className="account-nav" aria-label="بخش‌های حساب">
      <Link href="/account">خلاصه</Link>
      <Link href="/account/profile">پروفایل</Link>
      <Link href="/account/orders">سفارش‌ها</Link>
      <Link href="/account/addresses">نشانی‌ها</Link>
      <Link href="/wishlist">علاقه‌مندی‌ها</Link>
      <Link href="/account/alerts">هشدارها</Link>
      <Link href="/account/notifications">اطلاع‌رسانی</Link>
      <Link href="/find-it">درخواست‌ها</Link>
    </nav>
  );
}

export function AuthFrame({
  mode = "login",
  title,
  copy,
  children,
}: {
  mode?: "login" | "register";
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-shell auth-page">
      <div className="auth-card">
        <div className="auth-card-main">
          <Link
            className="auth-brand"
            href="/"
            aria-label="بازگشت به صفحه اصلی روا"
          >
            <strong>روا</strong>
            <bdi dir="ltr">RAVA</bdi>
          </Link>
          <nav className="auth-switch" aria-label="ورود یا ثبت‌نام">
            <Link
              href="/account/login"
              aria-current={mode === "login" ? "page" : undefined}
            >
              ورود
            </Link>
            <Link
              href="/account/register"
              aria-current={mode === "register" ? "page" : undefined}
            >
              ثبت‌نام
            </Link>
          </nav>
          <div className="auth-heading">
            <h1>{title}</h1>
            <p>{copy}</p>
          </div>
          {children}
        </div>
        <aside className="auth-assurance" aria-label="مزایای حساب روا">
          <span>حساب روا</span>
          <h2>خرید از آلمان، با مسیر روشن.</h2>
          <p>
            قیمت قطعی، وضعیت سفارش و رسیدهای شما در یک جای امن و ساده نگهداری
            می‌شوند.
          </p>
          <Link href="/authenticity">روا چطور خرید می‌کند؟</Link>
        </aside>
      </div>
    </div>
  );
}
