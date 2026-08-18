import { redirect } from "next/navigation";

import { loadEnvironment } from "@rava/config";
import { completeGatewayDeposit } from "@rava/db";
import {
  createPaymentGateway,
  PaymentVerificationError,
} from "@rava/integrations";

import { database } from "../../../../../server/db";
import { paymentForCallback } from "../../../../../server/checkout";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authority = url.searchParams.get("authority") ?? "";
  const status = url.searchParams.get("status");
  const payment = await paymentForCallback(authority);
  if (!payment) redirect("/cart?error=payment-not-found");
  try {
    const verified = await createPaymentGateway(
      loadEnvironment(),
    ).verifyPayment({
      authority,
      status,
      expectedAmountToman: payment.amountToman,
    });
    await completeGatewayDeposit(database(), verified);
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      redirect(`/account/orders/${payment.orderId}?error=payment`);
    }
    throw error;
  }
  redirect(`/account/orders/${payment.orderId}?notice=paid`);
}
