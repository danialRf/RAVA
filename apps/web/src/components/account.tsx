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
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-shell auth-page">
      <div className="auth-card">
        <Link className="auth-back" href="/account">
          بازگشت به حساب
        </Link>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children}
      </div>
    </div>
  );
}
