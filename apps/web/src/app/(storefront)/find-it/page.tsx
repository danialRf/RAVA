import Link from "next/link";
import { FormMessage } from "../../../components/account";
import { PageIntro } from "../../../components/storefront";
import { currentUser } from "../../../server/auth";
import { accountQueries } from "../../../server/account";
import { createProductRequestAction } from "../account/manage-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "برام پیدا کن" };

const requestStatusFa: Record<string, string> = {
  SUBMITTED: "ثبت‌شده",
  UNDER_REVIEW: "در حال بررسی",
  SOURCING: "در حال یافتن منبع",
  QUOTED: "پیشنهاد قیمت آماده",
  ACCEPTED: "پذیرفته‌شده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

export default async function FindItPage({
  searchParams,
}: PageProps<"/find-it">) {
  const [user, q] = await Promise.all([currentUser(), searchParams]);
  const requests = user ? await accountQueries.productRequests(user.id) : [];
  return (
    <div className="section-shell request-page">
      <PageIntro
        eyebrow="درخواست ویژه"
        title="برام پیدا کن"
        copy="یک لینک، عکس یا توضیح کوتاه کافی است؛ امکان تهیه را بررسی می‌کنیم."
      />
      <FormMessage
        error={typeof q.error === "string" ? q.error : undefined}
        notice={typeof q.notice === "string" ? q.notice : undefined}
      />
      {!user ? (
        <section className="sign-in-required">
          <h2>برای ثبت امن درخواست وارد شوید</h2>
          <p>عکس و اطلاعات تماس فقط در حساب شما و فضای خصوصی نگهداری می‌شود.</p>
          <Link className="button primary" href="/account/login">
            ورود به حساب
          </Link>
        </section>
      ) : (
        <>
          <form
            className="request-form"
            action={createProductRequestAction}
            encType="multipart/form-data"
          >
            <div className="form-grid">
              <label className="full">
                نام یا توضیح محصول
                <textarea
                  name="description"
                  rows={4}
                  placeholder="نام، مدل، رنگ یا هر نشانه‌ای که کمک می‌کند"
                  required
                />
              </label>
              <label>
                لینک محصول
                <input
                  name="referenceUrl"
                  type="url"
                  dir="ltr"
                  placeholder="https://"
                />
              </label>
              <label>
                حداکثر بودجه (تومان)
                <input name="budget" inputMode="numeric" dir="ltr" />
              </label>
              <label>
                راه تماس
                <input
                  name="phone"
                  inputMode="tel"
                  dir="ltr"
                  defaultValue={user.phoneE164 ?? ""}
                />
              </label>
              <label className="file-field full">
                عکس یا اسکرین‌شات
                <input
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
                <span>JPG، PNG یا WebP · حداکثر ۵ مگابایت</span>
              </label>
            </div>
            <label className="consent">
              <input type="checkbox" required />
              می‌دانم ثبت درخواست به‌معنای تضمین موجودی یا قیمت نیست.
            </label>
            <button className="button primary">ثبت درخواست</button>
          </form>
          {requests.length > 0 && (
            <section className="request-history">
              <h2>درخواست‌های قبلی</h2>
              {requests.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.descriptionFa}</strong>
                    <p>{item.referenceUrl ?? "بدون لینک"}</p>
                  </div>
                  <span>{requestStatusFa[item.status] ?? "وضعیت نامشخص"}</span>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
