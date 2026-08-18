import { randomUUID } from "node:crypto";

export interface PaymentRequest {
  readonly paymentId: string;
  readonly orderId: string;
  readonly amountToman: bigint;
  readonly callbackUrl: string;
  /**
   * Where the development gateway shows its simulated approval screen.
   *
   * A real gateway hosts that screen itself and ignores this; the fake one has
   * no host of its own, so the app supplies a local stand-in. Sending the
   * customer to a page (rather than straight to the callback) keeps the return
   * trip a real top-level browser navigation, exactly as production behaves.
   */
  readonly hostedPageUrl?: string;
}

export interface PaymentRedirect {
  readonly authority: string;
  readonly redirectUrl: string;
}

export interface PaymentCallback {
  readonly authority: string;
  readonly expectedAmountToman: bigint;
  readonly status: string | null;
}

export interface VerifiedPayment {
  readonly authority: string;
  readonly providerReference: string;
  readonly amountToman: bigint;
}

export interface PaymentGateway {
  readonly id: string;
  createPayment(input: PaymentRequest): Promise<PaymentRedirect>;
  verifyPayment(input: PaymentCallback): Promise<VerifiedPayment>;
}

export class PaymentVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

/** Development gateway: deterministic local redirect, no card data involved. */
export class FakePaymentGateway implements PaymentGateway {
  readonly id = "fake";

  async createPayment(input: PaymentRequest): Promise<PaymentRedirect> {
    if (input.amountToman <= 0n) {
      throw new PaymentVerificationError("Payment amount must be positive");
    }
    const authority = `FAKE-${input.paymentId}-${randomUUID().slice(0, 8)}`;
    if (input.hostedPageUrl !== undefined) {
      const hosted = new URL(input.hostedPageUrl);
      hosted.searchParams.set("authority", authority);
      return { authority, redirectUrl: hosted.toString() };
    }
    // Without a hosted screen the caller is driving the flow itself, so the
    // approved callback is returned directly.
    const url = new URL(input.callbackUrl);
    url.searchParams.set("authority", authority);
    url.searchParams.set("status", "ok");
    return { authority, redirectUrl: url.toString() };
  }

  async verifyPayment(input: PaymentCallback): Promise<VerifiedPayment> {
    if (!input.authority.startsWith("FAKE-") || input.status !== "ok") {
      throw new PaymentVerificationError("Fake payment was not approved");
    }
    if (input.expectedAmountToman <= 0n) {
      throw new PaymentVerificationError("Expected amount is invalid");
    }
    return {
      authority: input.authority,
      providerReference: `REF-${input.authority.slice(-8)}`,
      amountToman: input.expectedAmountToman,
    };
  }
}

export interface PaymentProviderConfiguration {
  readonly PAYMENT_PROVIDER: "fake" | "gateway";
}

export function createPaymentGateway(
  configuration: PaymentProviderConfiguration,
): PaymentGateway {
  if (configuration.PAYMENT_PROVIDER === "fake")
    return new FakePaymentGateway();
  throw new PaymentVerificationError(
    "Production payment gateway is not configured",
  );
}
