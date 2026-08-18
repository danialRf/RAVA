/**
 * Pure authentication rules shared by the web app and the repositories.
 *
 * Nothing here performs I/O: normalisation, policy limits and token
 * lifetimes only, so every rule stays unit-testable without infrastructure.
 */

/** Verifies an Iranian mobile number in the local 09… or +989… shapes. */
const IRANIAN_MOBILE = /^(\+98|0)?9\d{9}$/;

export function isEmail(candidate: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
}

export function normalizeEmail(candidate: string): string {
  return candidate.trim().toLowerCase();
}

/**
 * Accepts the ways customers type an Iranian mobile number and returns the
 * E.164 form the database constraint expects (`+989…`).
 *
 * Returns null for anything that is not an Iranian mobile number; other
 * countries are not supported at launch rather than being half-handled.
 */
export function normalizeIranianMobile(candidate: string): string | null {
  const trimmed = candidate.replace(/[\s()-]/g, "");
  if (!IRANIAN_MOBILE.test(trimmed)) return null;
  const significant = trimmed.replace(/^(\+98|0)/, "");
  return `+98${significant}`;
}

export function isIranianMobileE164(candidate: string): boolean {
  return /^\+989\d{9}$/.test(candidate);
}

/** Password policy: length first, the only rule that measurably matters. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyIssues(password: string): ReadonlyArray<string> {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(
      `گذرواژه باید حداقل ${PASSWORD_MIN_LENGTH.toLocaleString("fa-IR")} نویسه باشد.`,
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push("گذرواژه بیش از حد بلند است.");
  }
  return issues;
}

/** Single-use token purposes stored in `verification_tokens.purpose`. */
export const VERIFICATION_PURPOSES = {
  emailVerify: "EMAIL_VERIFY",
  emailChange: "EMAIL_CHANGE",
  passwordReset: "PASSWORD_RESET",
  phoneOtp: "PHONE_OTP",
} as const;

export type VerificationPurpose =
  (typeof VERIFICATION_PURPOSES)[keyof typeof VERIFICATION_PURPOSES];

/** Lifetimes in seconds. OTPs are short; email links are comfortable. */
export const TOKEN_TTL_SECONDS = {
  EMAIL_VERIFY: 60 * 60 * 24,
  EMAIL_CHANGE: 60 * 60 * 2,
  PASSWORD_RESET: 60 * 60,
  PHONE_OTP: 60 * 5,
} as const satisfies Record<VerificationPurpose, number>;

/** OTP codes are 6 digits; guessing 100 times must never be possible. */
export const OTP_MAX_ATTEMPTS = 5;

/** Sessions: 30 days sliding on use, absolute cap at 90 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_ABSOLUTE_TTL_SECONDS = 60 * 60 * 24 * 90;

/** A short-lived cookie that carries the OAuth round-trip state. */
export const OAUTH_STATE_TTL_SECONDS = 60 * 10;

export type SessionPrincipal = {
  readonly id: string;
  readonly role: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly phoneE164: string | null;
  readonly phoneVerifiedAt: Date | null;
};
