import Link from "next/link";
import { AuthFrame, FormMessage } from "../../../../components/account";
import { loginAction } from "../actions";

export default async function LoginPage({
  searchParams,
}: PageProps<"/account/login">) {
  const q = await searchParams;
  return (
    <AuthFrame
      mode="login"
      title="خوش آمدید"
      copy="برای دیدن سفارش‌ها و ادامه خرید وارد حساب خود شوید."
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
        <div className="auth-form-row">
          <Link href="/account/forgot-password">
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </div>
        <button className="button primary wide">ورود به حساب</button>
      </form>
      <p className="auth-alternative">
        حساب ندارید؟ <Link href="/account/register">ثبت‌نام کنید</Link>
      </p>
    </AuthFrame>
  );
}
