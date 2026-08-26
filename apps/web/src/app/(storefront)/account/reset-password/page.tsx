import { AuthFrame, FormMessage } from "../../../../components/account";
import { resetPasswordAction } from "../actions";

export default async function ResetPage({
  searchParams,
}: PageProps<"/account/reset-password">) {
  const q = await searchParams;
  const email = typeof q.email === "string" ? q.email : "";
  const token = typeof q.token === "string" ? q.token : "";
  return (
    <AuthFrame title="گذرواژه تازه" copy="لینک بازنشانی یک‌بار مصرف است.">
      <FormMessage error={typeof q.error === "string" ? q.error : undefined} />
      <form action={resetPasswordAction} className="auth-form">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <label>
          گذرواژه تازه
          <input
            name="password"
            type="password"
            dir="ltr"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
        <button className="button primary" disabled={!email || !token}>
          ذخیره گذرواژه
        </button>
      </form>
    </AuthFrame>
  );
}
