import Image from "next/image";
import Link from "next/link";

import { PageIntro } from "../../components/storefront";
import { formatToman } from "../../lib/format";
import { readCartModel } from "../../server/checkout";
import {
  createQuoteAction,
  removeCartItemAction,
  updateCartItemAction,
} from "../checkout/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "سبد خرید" };

const errors: Record<string, string> = {
  unavailable: "این کالا دیگر با منبع انتخاب‌شده قابل سفارش نیست.",
  "rate-limit":
    "تعداد درخواست قیمت زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.",
  CART_EMPTY: "سبد خرید خالی است.",
  ITEM_UNAVAILABLE: "قیمت یا موجودی یکی از کالاها تغییر کرده است.",
  FX_UNAVAILABLE: "فعلاً نرخ تازه و مطمئن ارز در دسترس نیست.",
};

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const [model, query] = await Promise.all([readCartModel(), searchParams]);
  const error =
    typeof query.error === "string"
      ? (errors[query.error] ?? "امکان ادامه وجود ندارد.")
      : null;
  return (
    <div className="section-shell cart-page">
      <PageIntro
        eyebrow={`${model.items.length.toLocaleString("fa-IR")} کالا`}
        title="سبد خرید شما"
        copy="قیمت این صفحه تخمینی است؛ پیش از پرداخت، قیمت قطعی ده‌دقیقه‌ای دریافت می‌کنید."
      />
      {query.notice === "added" && (
        <p className="form-message notice">کالا به سبد خرید اضافه شد.</p>
      )}
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {model.items.length === 0 ? (
        <div className="empty-state">
          <h2>سبد خرید خالی است</h2>
          <p>از میان انتخاب‌های کاتالوگ، کالای موردنظرتان را اضافه کنید.</p>
          <Link className="button primary" href="/category">
            دیدن محصولات
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="کالاهای سبد">
            <div className="cart-group-title">
              <h2>سفارش از منابع آلمان</h2>
              <span>قیمت نهایی پیش از پرداخت قفل می‌شود</span>
            </div>
            {model.items.map((item) => (
              <article className="cart-item" key={item.itemId}>
                <div className="cart-thumb">
                  <Image
                    src={item.imageUrl}
                    width={120}
                    height={144}
                    alt={item.titleFa}
                  />
                </div>
                <div>
                  <p dir="ltr">{item.brandName}</p>
                  <h3>
                    <Link href={`/product/${item.productSlug}`}>
                      {item.titleFa}
                    </Link>
                  </h3>
                  <span>{item.variantLabel}</span>
                  <strong>
                    {item.lineTotal === null
                      ? "قیمت فعلاً در دسترس نیست"
                      : `حدود ${formatToman(item.lineTotal)} تومان`}
                  </strong>
                  <div className="cart-item-actions">
                    <form action={updateCartItemAction}>
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <label>
                        تعداد
                        <select name="quantity" defaultValue={item.quantity}>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value.toLocaleString("fa-IR")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button>به‌روزرسانی</button>
                    </form>
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <button>حذف</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </section>
          <aside className="cart-summary">
            <p className="eyebrow">خلاصه سفارش</p>
            <h2>قبل از پرداخت</h2>
            <dl>
              <div>
                <dt>جمع تخمینی</dt>
                <dd>{formatToman(model.total)} تومان</dd>
              </div>
              <div>
                <dt>پیش‌پرداخت تخمینی</dt>
                <dd>{formatToman(model.deposit)} تومان</dd>
              </div>
            </dl>
            <p>
              قیمت منبع، موجودی و نرخ ارز دوباره بررسی می‌شوند. مبلغ قطعی تا ده
              دقیقه تغییر نمی‌کند.
            </p>
            <form action={createQuoteAction}>
              <button
                className="button primary wide"
                disabled={model.items.some((item) => item.estimate === null)}
              >
                دریافت قیمت قطعی
              </button>
            </form>
            <Link href="/category">ادامه خرید</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
