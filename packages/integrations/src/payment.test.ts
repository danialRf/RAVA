import { describe, expect, it } from "vitest";

import { FakePaymentGateway, PaymentVerificationError } from "./payment";

describe("FakePaymentGateway", () => {
  it("creates and verifies a local payment without card data", async () => {
    const gateway = new FakePaymentGateway();
    const created = await gateway.createPayment({
      paymentId: "payment-1",
      orderId: "order-1",
      amountToman: 3_500_000n,
      callbackUrl: "http://localhost/api/payments/fake/callback",
    });
    const callback = new URL(created.redirectUrl);
    await expect(
      gateway.verifyPayment({
        authority: created.authority,
        status: callback.searchParams.get("status"),
        expectedAmountToman: 3_500_000n,
      }),
    ).resolves.toMatchObject({ amountToman: 3_500_000n });
  });

  it("rejects a failed or forged callback", async () => {
    const gateway = new FakePaymentGateway();
    await expect(
      gateway.verifyPayment({
        authority: "not-fake",
        status: "ok",
        expectedAmountToman: 1n,
      }),
    ).rejects.toBeInstanceOf(PaymentVerificationError);
  });
});
