import Link from "next/link";
import { AuthFrame, FormMessage } from "../../../components/account";
import { registerAction } from "../actions";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/account/register">) {
  const q = await searchParams;
  return (
    <AuthFrame
      title="ساخت حساب"
      copy="برای حفاظت بهتر، گذرواژه حداقل ۱۰ نویسه باشد."
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
        <button className="button primary">ساخت حساب</button>
      </form>
      <div className="auth-links">
        <Link href="/account/login">حساب دارم؛ وارد می‌شوم</Link>
      </div>
    </AuthFrame>
  );
}
