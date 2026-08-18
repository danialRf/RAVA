import { AuthFrame, FormMessage } from "../../../components/account";
import { forgotPasswordAction } from "../actions";

export default async function ForgotPage({
  searchParams,
}: PageProps<"/account/forgot-password">) {
  const q = await searchParams;
  return (
    <AuthFrame
      title="بازنشانی گذرواژه"
      copy="برای جلوگیری از افشای حساب‌ها، پاسخ همیشه یکسان است."
    >
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      <form action={forgotPasswordAction} className="auth-form">
        <label>
          ایمیل
          <input name="email" type="email" dir="ltr" required />
        </label>
        <button className="button primary">درخواست لینک</button>
      </form>
    </AuthFrame>
  );
}
