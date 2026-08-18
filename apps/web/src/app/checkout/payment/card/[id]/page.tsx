import { notFound, redirect } from "next/navigation";

import { findOwnedPayment } from "@rava/db";

import { PageIntro } from "../../../../../components/storefront";
import { formatToman } from "../../../../../lib/format";
import { currentUser } from "../../../../../server/auth";
import { database } from "../../../../../server/db";
import { uploadReceiptAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function CardReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const owned = await findOwnedPayment(database(), {
    paymentId: id,
    userId: user.id,
  });
  if (!owned || owned.payment.method !== "CARD_TO_CARD") notFound();
  return (
    <div className="section-shell checkout-page receipt-page">
      <PageIntro
        eyebrow="پرداخت کارت‌به‌کارت"
        title="ثبت رسید پرداخت"
        copy="رسید فقط در فضای خصوصی ذخیره می‌شود و پس از بررسی مالی، وضعیت سفارش تغییر می‌کند."
      />
      {query.error && (
        <p className="form-message error">
          فایل باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.
        </p>
      )}
      <section className="receipt-card">
        <dl>
          <div>
            <dt>مبلغ</dt>
            <dd>{formatToman(owned.payment.amountToman)} تومان</dd>
          </div>
          <div>
            <dt>شماره سفارش</dt>
            <dd dir="ltr">{owned.order.orderNumber}</dd>
          </div>
        </dl>
        <p>
          اطلاعات حساب مقصد در نسخه production توسط واحد مالی تنظیم می‌شود. در
          محیط توسعه فقط گردش ثبت رسید آزمایش می‌شود.
        </p>
        <form action={uploadReceiptAction} className="auth-form">
          <input type="hidden" name="paymentId" value={owned.payment.id} />
          <input type="hidden" name="orderId" value={owned.order.id} />
          <label>
            تصویر رسید
            <input
              type="file"
              name="receipt"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <button className="button primary">ارسال برای بررسی</button>
        </form>
      </section>
    </div>
  );
}
