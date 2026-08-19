import Link from "next/link";
import { AuthFrame, FormMessage } from "../../../components/account";
import { registerAction } from "../actions";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/account/register">) {
  const q = await searchParams;
  return (
    <AuthFrame
      mode="register"
      title="ساخت حساب روا"
      copy="اطلاعات اصلی را وارد کنید؛ ساخت حساب کمتر از یک دقیقه زمان می‌برد."
    >
      <FormMessage error={typeof q.error === "string" ? q.error : undefined} />
      <form action={registerAction} className="auth-form">
        <label>
          نام نمایشی
          <input name="displayName" autoComplete="name" maxLength={80} />
        </label>
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
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
        <small className="auth-password-hint">
          رمز عبور باید حداقل ۱۰ نویسه داشته باشد.
        </small>
        <button className="button primary wide">ثبت‌نام</button>
      </form>
      <p className="auth-alternative">
        قبلاً ثبت‌نام کرده‌اید؟ <Link href="/account/login">وارد شوید</Link>
      </p>
    </AuthFrame>
  );
}
