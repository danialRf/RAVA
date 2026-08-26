import { AuthFrame } from "../../../../components/account";
import { verifyEmailAction } from "../actions";

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/account/verify-email">) {
  const q = await searchParams;
  const email = typeof q.email === "string" ? q.email : "";
  const token = typeof q.token === "string" ? q.token : "";
  return (
    <AuthFrame
      title="تأیید ایمیل"
      copy="برای نهایی‌کردن تأیید، دکمه زیر را بزنید."
    >
      <form action={verifyEmailAction} className="auth-form">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <button className="button primary" disabled={!email || !token}>
          تأیید نشانی ایمیل
        </button>
      </form>
    </AuthFrame>
  );
}
