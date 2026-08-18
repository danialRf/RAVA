/**
 * Email providers for verification and password-reset delivery.
 *
 * docs/AUTH_PAYMENTS.md requires verification/reset architecture with a
 * console development provider; the transactional email service is chosen
 * later and wired in without touching callers.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subjectFa: string;
  /** Plain-text body; Persian-first. */
  readonly bodyFa: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(providerId: string, reason: string) {
    super(`Email provider ${providerId} failed: ${reason}`);
    this.name = "EmailDeliveryError";
  }
}

/** Development provider: prints the message to the server console. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly id = "console";
  readonly #log: (line: string) => void;

  constructor(log: (line: string) => void = console.log) {
    this.#log = log;
  }

  async send(message: EmailMessage): Promise<void> {
    this.#log(
      `[email:console] to=${message.to} subject="${message.subjectFa}"\n${message.bodyFa}`,
    );
  }
}

/**
 * Placeholder for the production provider. Fails loudly rather than
 * pretending the mail was sent.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly id = "smtp";

  async send(): Promise<void> {
    throw new EmailDeliveryError(
      this.id,
      "no production email adapter is implemented yet",
    );
  }
}

export interface EmailProviderConfiguration {
  readonly EMAIL_PROVIDER: "console" | "smtp";
}

export function createEmailProvider(
  configuration: EmailProviderConfiguration,
): EmailProvider {
  switch (configuration.EMAIL_PROVIDER) {
    case "console":
      return new ConsoleEmailProvider();
    case "smtp":
      return new SmtpEmailProvider();
  }
}

/** Verification email with the one-time link the customer must click. */
export function verificationEmail(to: string, verifyUrl: string): EmailMessage {
  return {
    to,
    subjectFa: "روا — تأیید نشانی ایمیل",
    bodyFa: `سلام،\n\nبرای تأیید نشانی ایمیل خود این نشانی را باز کنید:\n${verifyUrl}\n\nاگر شما این درخواست را نداده‌اید، این پیام را نادیده بگیرید.`,
  };
}

/** Password-reset email with the single-use reset link. */
export function passwordResetEmail(to: string, resetUrl: string): EmailMessage {
  return {
    to,
    subjectFa: "روا — بازنشانی گذرواژه",
    bodyFa: `سلام،\n\nبرای انتخاب گذرواژه تازه این نشانی را باز کنید:\n${resetUrl}\n\nاین نشانی یک‌بار و فقط برای یک ساعت معتبر است.\nاگر شما این درخواست را نداده‌اید، نیازی به اقدام نیست.`,
  };
}
