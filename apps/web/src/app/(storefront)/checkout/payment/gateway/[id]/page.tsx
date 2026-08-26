import { notFound, redirect } from "next/navigation";

import { findOwnedPayment } from "@rava/db";

import { PageIntro } from "../../../../../../components/storefront";
import { formatToman } from "../../../../../../lib/format";
import { currentUser } from "../../../../../../server/auth";
import { database } from "../../../../../../server/db";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Simulated bank approval screen for the development gateway.
 *
 * A production gateway hosts this page itself. Standing it in locally keeps the
 * flow honest in two ways: the customer visibly leaves RAVA to approve a
 * payment, and the return trip is a real top-level browser navigation to the
 * callback, which is what a live gateway performs.
 *
 * No card data is ever collected here, and the screen is explicitly labeled as
 * a development simulation.
 */
export default async function GatewaySimulatorPage({
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
  if (!owned || owned.payment.method !== "GATEWAY") notFound();

  const authority = owned.payment.providerAuthority ?? "";
  if (typeof query.authority === "string" && query.authority !== authority)
    notFound();
  if (authority === "") notFound();

  return (
    <div className="section-shell checkout-page gateway-page">
      <PageIntro
        eyebrow="درگاه پرداخت آزمایشی"
        title="تأیید پیش‌پرداخت"
        copy="این صفحه شبیه‌سازی درگاه بانکی برای محیط توسعه است. هیچ اطلاعات کارتی دریافت یا ذخیره نمی‌شود."
      />

      <section className="receipt-card">
        <dl>
          <div>
            <dt>مبلغ پیش‌پرداخت</dt>
            <dd>{formatToman(owned.payment.amountToman)} تومان</dd>
          </div>
          <div>
            <dt>شماره سفارش</dt>
            <dd dir="ltr">{owned.order.orderNumber}</dd>
          </div>
        </dl>

        {/*
          A plain GET form, so approving performs a genuine browser navigation
          to the callback exactly as a real gateway return would.
        */}
        <form method="get" action="/api/payments/fake/callback">
          <input type="hidden" name="authority" value={authority} />
          <input type="hidden" name="status" value="ok" />
          <button className="button primary wide">پرداخت آزمایشی امن</button>
        </form>

        <form method="get" action="/api/payments/fake/callback">
          <input type="hidden" name="authority" value={authority} />
          <input type="hidden" name="status" value="cancelled" />
          <button className="button secondary wide">انصراف از پرداخت</button>
        </form>
      </section>
    </div>
  );
}
