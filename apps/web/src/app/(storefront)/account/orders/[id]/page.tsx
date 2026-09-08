import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountNav } from "../../../../../components/account";
import { PageIntro } from "../../../../../components/storefront";
import { formatDate, formatToman } from "../../../../../lib/format";
import {
  orderStatusFa,
  procurementStatusFa,
} from "../../../../../lib/order-status";
import { currentUser } from "../../../../../server/auth";
import { readOwnedOrder } from "../../../../../server/checkout";
import {
  beginBalancePaymentAction,
  decideOrderReconfirmationAction,
} from "../../manage-actions";

export const metadata = {
  title: "جزئیات سفارش",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/account/login");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await readOwnedOrder(id, user.id);
  if (!result) notFound();
  const resumablePayment = result.payments.find(
    (payment) =>
      payment.type === "DEPOSIT" &&
      ["INITIATED", "PENDING_VERIFICATION"].includes(payment.status),
  );
  const paymentHref =
    result.order.status !== "DEPOSIT_PENDING" || !resumablePayment
      ? null
      : resumablePayment.method === "GATEWAY" &&
          resumablePayment.providerAuthority
        ? `/checkout/payment/gateway/${resumablePayment.id}?authority=${encodeURIComponent(resumablePayment.providerAuthority)}`
        : resumablePayment.method === "CARD_TO_CARD"
          ? `/checkout/payment/card/${resumablePayment.id}`
          : null;
  return (
    <div className="section-shell account-page order-page">
      <PageIntro
        eyebrow="سفارش من"
        title={result.order.orderNumber}
        copy={orderStatusFa(result.order.status)}
      />
      <AccountNav />
      {query.notice === "paid" && (
        <p className="form-message notice">پیش‌پرداخت با موفقیت تأیید شد.</p>
      )}
      {query.notice === "receipt" && (
        <p className="form-message notice">
          رسید دریافت شد و در انتظار بررسی مالی است.
        </p>
      )}
      {query.notice === "balance-paid" && (
        <p className="form-message notice">مانده سفارش با موفقیت پرداخت شد.</p>
      )}
      {typeof query.notice === "string" &&
        !["paid", "receipt", "balance-paid"].includes(query.notice) && (
          <p className="form-message notice">{query.notice}</p>
        )}
      {query.error && (
        <p className="form-message error">
          پرداخت تأیید نشد؛ مبلغی در سفارش ثبت نشده است.
        </p>
      )}
      <div className="order-overview">
        <section>
          <h2>کالاها</h2>
          {result.items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.productSnapshot.titleFa}</strong>
                <span>
                  {item.productSnapshot.brand} ·{" "}
                  {item.productSnapshot.variant.label}
                </span>
                <span className="order-item-progress">
                  {procurementStatusFa(item.procurementStatus)}
                </span>
              </div>
              <strong>{formatToman(item.lineTotalToman)} تومان</strong>
            </article>
          ))}
        </section>
        <aside>
          <h2>خلاصه مالی</h2>
          <dl>
            <div>
              <dt>مبلغ قفل‌شده</dt>
              <dd>{formatToman(result.order.totalLockedToman)} تومان</dd>
            </div>
            <div>
              <dt>پیش‌پرداخت</dt>
              <dd>{formatToman(result.order.depositRequiredToman)} تومان</dd>
            </div>
            <div>
              <dt>پرداخت‌شده</dt>
              <dd>
                {formatToman(
                  result.order.depositPaidToman + result.order.balancePaidToman,
                )}{" "}
                تومان
              </dd>
            </div>
            <div>
              <dt>مانده قابل پرداخت</dt>
              <dd>
                {formatToman(
                  result.order.balanceDueToman - result.order.balancePaidToman,
                )}{" "}
                تومان
              </dd>
            </div>
          </dl>
          {paymentHref && (
            <Link className="button primary wide" href={paymentHref}>
              {resumablePayment?.method === "GATEWAY"
                ? "ادامه پرداخت آنلاین"
                : "ارسال یا ویرایش رسید"}
            </Link>
          )}
          {result.order.status === "BALANCE_DUE" && (
            <form action={beginBalancePaymentAction} className="auth-form">
              <input type="hidden" name="orderId" value={result.order.id} />
              <label>
                روش پرداخت مانده
                <select name="method" defaultValue="GATEWAY">
                  <option value="GATEWAY">درگاه آنلاین</option>
                  <option value="CARD_TO_CARD">کارت‌به‌کارت</option>
                </select>
              </label>
              <button className="button primary wide">
                پرداخت مانده سفارش
              </button>
            </form>
          )}
          <Link href="/account">بازگشت به حساب</Link>
        </aside>
      </div>
      {result.order.status === "CUSTOMER_RECONFIRMATION_REQUIRED" && (
        <section className="receipt-card">
          <h2>تصمیم شما برای ادامه سفارش</h2>
          <p>
            یکی از اقلام در منبع قبلی موجود نیست. می‌توانید تهیه از منبع جایگزین
            را ادامه دهید یا سفارش را برای بازپرداخت لغو کنید. مبلغ قفل‌شده بدون
            تأیید شما تغییر نمی‌کند.
          </p>
          <form action={decideOrderReconfirmationAction} className="auth-form">
            <input type="hidden" name="orderId" value={result.order.id} />
            <button name="decision" value="CONTINUE" className="button primary">
              ادامه تهیه با مبلغ قفل‌شده
            </button>
            <button name="decision" value="CANCEL" className="button danger">
              لغو و درخواست بازپرداخت
            </button>
          </form>
        </section>
      )}
      <section className="receipt-card">
        <h2>مسیر سفارش</h2>
        {result.trip && (
          <p>
            سفر: <strong>{result.trip.title}</strong>{" "}
            <span dir="ltr">({result.trip.code})</span>
          </p>
        )}
        {result.delivery && (
          <p>
            ارسال داخلی: {result.delivery.courier ?? "در انتظار تخصیص"}
            {result.delivery.trackingCode && (
              <>
                {" "}
                · کد پیگیری <b dir="ltr">{result.delivery.trackingCode}</b>
              </>
            )}
          </p>
        )}
        <ol className="order-timeline">
          {result.history.map((entry) => (
            <li key={entry.id}>
              <strong>{orderStatusFa(entry.toStatus)}</strong>
              <small>{formatDate(entry.createdAt)}</small>
              {entry.note && <span>{entry.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
