import Link from "next/link";
import { AuthFrame, FormMessage } from "../../../components/account";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: PageProps<"/account/login">) {
  const q = await searchParams;
  return (
    <AuthFrame
      title="ورود به روا"
      copy="اطلاعات ورود فقط در سرور بررسی می‌شود."
    >
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <form action={loginAction} className="auth-form">
        <input
          type="hidden"
          name="redirectTo"
          value={typeof q.next === "string" ? q.next : "/account"}
        />
        <label>
          ایمیل
          <input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
          />
        </label>
        <label>
          گذرواژه
          <input
            name="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button primary">ورود</button>
      </form>
      <div className="auth-links">
        <Link href="/account/forgot-password">گذرواژه را فراموش کرده‌ام</Link>
        <Link href="/account/register">ساخت حساب تازه</Link>
        <Link href="/account/otp">ورود با شماره موبایل</Link>
      </div>
    </AuthFrame>
  );
}
