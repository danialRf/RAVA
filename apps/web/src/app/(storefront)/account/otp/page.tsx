import { AuthFrame, FormMessage } from "../../../../components/account";
import { requestOtpAction, verifyOtpAction } from "../actions";

export default async function OtpPage({
  searchParams,
}: PageProps<"/account/otp">) {
  const q = await searchParams;
  const phone = typeof q.phone === "string" ? q.phone : "";
  const sent = q.sent === "1";
  return (
    <AuthFrame
      title="ورود با موبایل"
      copy="در محیط توسعه، کد از Fake SMS در کنسول سرور چاپ می‌شود."
    >
      <FormMessage error={typeof q.error === "string" ? q.error : undefined} />
      {sent ? (
        <form action={verifyOtpAction} className="auth-form">
          <input type="hidden" name="phone" value={phone} />
          <label>
            کد شش‌رقمی
            <input
              name="code"
              inputMode="numeric"
              dir="ltr"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="button primary">تأیید و ورود</button>
        </form>
      ) : (
        <form action={requestOtpAction} className="auth-form">
          <label>
            شماره موبایل
            <input
              name="phone"
              inputMode="tel"
              dir="ltr"
              placeholder="09123456789"
              required
            />
          </label>
          <button className="button primary">دریافت کد</button>
        </form>
      )}
    </AuthFrame>
  );
}
