import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listAddresses } from "@rava/db";

import { QuoteCountdown } from "../../../../components/quote-countdown";
import { PageIntro } from "../../../../components/storefront";
import { formatToman } from "../../../../lib/format";
import { currentUser } from "../../../../server/auth";
import { readOwnedQuote } from "../../../../server/checkout";
import { database } from "../../../../server/db";
import { beginPaymentAction, createQuoteAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "قیمت قطعی و پرداخت" };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/account/login?next=%2Fcart");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await readOwnedQuote(id, user.id);
  if (!result) notFound();
  const addresses = await listAddresses(database(), user.id);
  const previousId = typeof query.previous === "string" ? query.previous : null;
  const previous = previousId
    ? await readOwnedQuote(previousId, user.id)
    : null;
  const difference = previous
    ? result.quote.finalToman - previous.quote.finalToman
    : null;
  const expired =
    result.quote.status !== "ACTIVE" || result.quote.expiresAt <= new Date();
  const error = typeof query.error === "string" ? query.error : null;

  return (
    <div className="section-shell checkout-page">
      <PageIntro
        eyebrow="قیمت قطعی کوتاه‌مدت"
        title="مرور و پرداخت پیش‌پرداخت"
        copy="این مبلغ با نرخ تازه و اطلاعات فعلی منبع محاسبه و برای ده دقیقه قفل شده است."
      />
      <QuoteCountdown expiresAt={result.quote.expiresAt.toISOString()} />
      {difference !== null && (
        <p className={`quote-difference ${difference > 0n ? "up" : "down"}`}>
          {difference === 0n
            ? "قیمت تازه با پیشنهاد قبلی یکسان است."
            : `قیمت تازه ${formatToman(difference < 0n ? -difference : difference)} تومان ${difference > 0n ? "بیشتر" : "کمتر"} از پیشنهاد قبلی است.`}
        </p>
      )}
      {error && (
        <p className="form-message error" role="alert">
          قیمت یا موجودی تغییر کرده است؛ یک قیمت تازه دریافت کنید.
        </p>
      )}
      <div className="checkout-layout">
        <section className="quote-lines">
          <h2>جزئیات قیمت</h2>
          {result.items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.breakdown.titleFa ?? "محصول"}</strong>
                <span>
                  {item.breakdown.brand} · {item.breakdown.variant}
                </span>
                <small>{item.breakdown.retailer}</small>
              </div>
              <div>
                <span>{item.quantity.toLocaleString("fa-IR")} عدد</span>
                <strong>{formatToman(item.lineTotalToman)} تومان</strong>
              </div>
            </article>
          ))}
          <p className="quote-source-note">
            قیمت منبع و موجودی یک بار دیگر درست هنگام ساخت سفارش کنترل می‌شوند.
          </p>
        </section>
        <aside className="quote-summary">
          <h2>مبلغ قفل‌شده</h2>
          <dl>
            <div>
              <dt>کل سفارش</dt>
              <dd>{formatToman(result.quote.finalToman)} تومان</dd>
            </div>
            <div className="deposit">
              <dt>پرداخت امروز</dt>
              <dd>{formatToman(result.quote.depositToman)} تومان</dd>
            </div>
            <div>
              <dt>مانده بعدی</dt>
              <dd>{formatToman(result.quote.balanceToman)} تومان</dd>
            </div>
          </dl>
          {expired ? (
            <form action={createQuoteAction}>
              <input
                type="hidden"
                name="previousQuoteId"
                value={result.quote.id}
              />
              <button className="button primary wide">دریافت قیمت تازه</button>
            </form>
          ) : addresses.length === 0 ? (
            <div className="checkout-address-missing">
              <p>برای ادامه، ابتدا یک نشانی تحویل ثبت کنید.</p>
              <Link className="button primary wide" href="/account/addresses">
                ثبت نشانی
              </Link>
            </div>
          ) : (
            <form action={beginPaymentAction} className="checkout-form">
              <input type="hidden" name="quoteId" value={result.quote.id} />
              <label>
                نشانی تحویل
                <select
                  name="addressId"
                  required
                  defaultValue={
                    addresses.find((item) => item.isDefault)?.id ??
                    addresses[0]?.id
                  }
                >
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.recipientName} — {address.city}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary wide"
                name="method"
                value="GATEWAY"
              >
                پرداخت با درگاه بانکی
              </button>
              <button
                className="button secondary wide"
                name="method"
                value="CARD_TO_CARD"
              >
                ثبت رسید کارت‌به‌کارت
              </button>
              <small>هیچ اطلاعات کارت بانکی در روا ذخیره نمی‌شود.</small>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
