/**
 * SMS providers for mobile OTP delivery.
 *
 * docs/AUTH_PAYMENTS.md: a custom `SmsProvider` interface, a deterministic
 * fake for development, and the real Iranian provider plugged in later. No
 * feature may be blocked waiting for SMS credentials.
 */

export interface OtpSmsInput {
  readonly phoneE164: string;
  readonly code: string;
  /** Minutes the code stays valid, for the message body. */
  readonly validForMinutes: number;
}

export interface SmsProvider {
  readonly id: string;
  sendOtpSms(input: OtpSmsInput): Promise<void>;
}

export class SmsDeliveryError extends Error {
  constructor(providerId: string, reason: string) {
    super(`SMS provider ${providerId} failed: ${reason}`);
    this.name = "SmsDeliveryError";
  }
}

/**
 * Development provider: writes the OTP to the server console/test harness
 * only. It never contacts a real phone network.
 */
export class FakeSmsProvider implements SmsProvider {
  readonly id = "fake";
  readonly #log: (line: string) => void;

  constructor(log: (line: string) => void = console.log) {
    this.#log = log;
  }

  async sendOtpSms(input: OtpSmsInput): Promise<void> {
    this.#log(
      `[sms:fake] OTP for ${input.phoneE164}: ${input.code} (valid ${input.validForMinutes} minutes)`,
    );
  }
}

/**
 * Placeholder for the selected Iranian provider. Fails loudly so a missing
 * adapter can never silently degrade into "delivered".
 */
export class ApiSmsProvider implements SmsProvider {
  readonly id = "api";

  async sendOtpSms(): Promise<void> {
    throw new SmsDeliveryError(
      this.id,
      "no production SMS adapter is implemented yet",
    );
  }
}

export interface SmsProviderConfiguration {
  readonly SMS_PROVIDER: "fake" | "api";
}

export function createSmsProvider(
  configuration: SmsProviderConfiguration,
): SmsProvider {
  switch (configuration.SMS_PROVIDER) {
    case "fake":
      return new FakeSmsProvider();
    case "api":
      return new ApiSmsProvider();
  }
}
