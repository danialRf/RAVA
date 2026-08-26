import Link from "next/link";
import { Icon } from "../../../components/icons";
import { PageIntro } from "../../../components/storefront";

export const metadata = { title: "اصالت و منبع" };

export default function AuthenticityPage() {
  return (
    <div className="section-shell authenticity-page">
      <PageIntro
        eyebrow="اعتماد بدون اغراق"
        title="«منبع بررسی‌شده» یعنی چه؟"
        copy="روا میان بررسی فروشنده، مدرک خرید و ضمانت پس از تهیه تفاوت روشن می‌گذارد."
      />
      <div className="auth-lead">
        <Icon name="shield" width="48" />
        <p>
          پیش از خرید، می‌توانیم درباره اعتبار منبع صحبت کنیم؛ نه اینکه بدون
          دیدن کالای فیزیکی، اصالت آن را قطعی اعلام کنیم.
        </p>
      </div>
      <section className="auth-steps">
        <article>
          <span>۱</span>
          <h2>بررسی منبع</h2>
          <p>
            اطلاعات فروشگاه، نوع فروشنده و سابقه قابل اتکا بررسی می‌شود.
            پیشنهادهای بازارگاهی بدون منشأ روشن نیازمند بررسی دستی‌اند.
          </p>
        </article>
        <article>
          <span>۲</span>
          <h2>ثبت خرید</h2>
          <p>
            بعد از تهیه از منبع تأییدشده، مدرک خرید برای حسابرسی سفارش نگهداری
            می‌شود و بخش مجاز آن می‌تواند در حساب مشتری نمایش داده شود.
          </p>
        </article>
        <article>
          <span>۳</span>
          <h2>ضمانت روا</h2>
          <p>
            تنها پس از تهیه و طبق سیاست تجاری مصوب، سفارش می‌تواند واجد ضمانت
            اصالت روا شود. این وضعیت با بررسی منبع یکسان نیست.
          </p>
        </article>
      </section>
      <section className="limits">
        <h2>چیزهایی که ادعا نمی‌کنیم</h2>
        <ul>
          <li>هوش مصنوعی یا تصویر، اصالت فیزیکی کالا را ثابت نمی‌کند.</li>
          <li>«منبع بررسی‌شده» به‌تنهایی ضمانت فیزیکی محصول نیست.</li>
          <li>تا پیش از تهیه، موجودی یا قیمت فروشگاه خارجی قطعی نیست.</li>
        </ul>
      </section>
      <div className="auth-cta">
        <div>
          <h2>درباره یک محصول سؤال دارید؟</h2>
          <p>لینک یا تصویرش را بفرستید تا منبع و امکان تهیه بررسی شود.</p>
        </div>
        <Link className="button primary" href="/find-it">
          ثبت درخواست
        </Link>
      </div>
    </div>
  );
}
