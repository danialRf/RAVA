"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";

import { loadEnvironment } from "@rava/config";
import {
  createUserWithPassword,
  deleteAllUserSessions,
  ensureCustomerByPhone,
  findUserByEmail,
  findUserByPhone,
  issueVerificationToken,
  linkVerifiedPhone,
  markEmailVerified,
  updateUserPassword,
  consumeVerificationToken,
} from "@rava/db";
import {
  normalizeEmail,
  isEmail,
  normalizeIranianMobile,
  passwordPolicyIssues,
  TOKEN_TTL_SECONDS,
  VERIFICATION_PURPOSES,
} from "@rava/domain";
import {
  createEmailProvider,
  createSmsProvider,
  hashPassword,
  passwordResetEmail,
  verificationEmail,
  verifyPassword,
} from "@rava/integrations";

import { siteUrl } from "../../lib/site";
import {
  createAuthSession,
  currentUser,
  destroyCurrentSession,
  enforceRateLimit,
  hashSecret,
  randomToken,
} from "../../server/auth";
import { database } from "../../server/db";
import { migrateAnonymousWishlist } from "../../server/session";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function go(path: string, key: "error" | "notice", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function safeRedirectPath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

async function finishSignIn(
  userId: string,
  redirectTo = "/account",
): Promise<never> {
  await createAuthSession(userId);
  await migrateAnonymousWishlist(userId);
  redirect(safeRedirectPath(redirectTo));
}

async function sendVerification(email: string): Promise<void> {
  const environment = loadEnvironment();
  const raw = randomToken();
  await issueVerificationToken(database(), {
    identifier: email,
    purpose: VERIFICATION_PURPOSES.emailVerify,
    tokenHash: hashSecret(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS.EMAIL_VERIFY * 1000),
  });
  const url = new URL("/account/verify-email", siteUrl());
  url.searchParams.set("email", email);
  url.searchParams.set("token", raw);
  await createEmailProvider(environment).send(
    verificationEmail(email, url.toString()),
  );
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const displayName = text(formData, "displayName").slice(0, 80) || null;
  if (!isEmail(email)) go("/account/register", "error", "ایمیل معتبر نیست.");
  const issue = passwordPolicyIssues(password)[0];
  if (issue) go("/account/register", "error", issue);
  if (!(await enforceRateLimit("register", email, 5))) {
    go(
      "/account/register",
      "error",
      "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
    );
  }
  const user = await createUserWithPassword(database(), {
    email,
    passwordHash: await hashPassword(password),
    displayName,
  });
  if (!user) go("/account/login", "error", "این ایمیل قبلاً ثبت شده است.");
  await sendVerification(email);
  await finishSignIn(user.id);
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  if (!(await enforceRateLimit("login", email, 8))) {
    go(
      "/account/login",
      "error",
      "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.",
    );
  }
  const user = await findUserByEmail(database(), email);
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    go("/account/login", "error", "ایمیل یا گذرواژه درست نیست.");
  }
  await finishSignIn(user.id, text(formData, "redirectTo"));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}

export async function resendVerificationAction(): Promise<void> {
  const user = await currentUser();
  if (!user?.email || user.emailVerifiedAt) redirect("/account");
  if (!(await enforceRateLimit("verify-email", user.email, 3, 3600))) {
    go("/account", "error", "ایمیل تأیید اخیراً ارسال شده است.");
  }
  await sendVerification(user.email);
  go("/account", "notice", "لینک تأیید در خروجی سرویس ایمیل توسعه ثبت شد.");
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(text(formData, "email"));
  const token = text(formData, "token");
  const result = await consumeVerificationToken(database(), {
    identifier: email,
    purpose: VERIFICATION_PURPOSES.emailVerify,
    tokenHash: hashSecret(token),
    now: new Date(),
  });
  if (result.outcome !== "consumed")
    go("/account/login", "error", "لینک تأیید نامعتبر یا منقضی است.");
  const user = await findUserByEmail(database(), email);
  if (user) await markEmailVerified(database(), user.id, new Date());
  go("/account", "notice", "ایمیل شما تأیید شد.");
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(text(formData, "email"));
  if (await enforceRateLimit("password-reset", email, 3, 3600)) {
    const user = await findUserByEmail(database(), email);
    if (user) {
      const raw = randomToken();
      await issueVerificationToken(database(), {
        identifier: email,
        purpose: VERIFICATION_PURPOSES.passwordReset,
        tokenHash: hashSecret(raw),
        expiresAt: new Date(
          Date.now() + TOKEN_TTL_SECONDS.PASSWORD_RESET * 1000,
        ),
      });
      const url = new URL("/account/reset-password", siteUrl());
      url.searchParams.set("email", email);
      url.searchParams.set("token", raw);
      await createEmailProvider(loadEnvironment()).send(
        passwordResetEmail(email, url.toString()),
      );
    }
  }
  go(
    "/account/forgot-password",
    "notice",
    "اگر حسابی با این ایمیل باشد، لینک بازنشانی ارسال شده است.",
  );
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(text(formData, "email"));
  const token = text(formData, "token");
  const password = text(formData, "password");
  const issue = passwordPolicyIssues(password)[0];
  if (issue) {
    const target = new URLSearchParams({ email, token, error: issue });
    redirect(`/account/reset-password?${target.toString()}`);
  }
  const result = await consumeVerificationToken(database(), {
    identifier: email,
    purpose: VERIFICATION_PURPOSES.passwordReset,
    tokenHash: hashSecret(token),
    now: new Date(),
  });
  if (result.outcome !== "consumed")
    go("/account/forgot-password", "error", "لینک نامعتبر یا منقضی است.");
  const user = await findUserByEmail(database(), email);
  if (user) {
    await updateUserPassword(database(), {
      userId: user.id,
      passwordHash: await hashPassword(password),
    });
    await deleteAllUserSessions(database(), user.id);
  }
  go("/account/login", "notice", "گذرواژه تغییر کرد؛ حالا وارد شوید.");
}

export async function requestOtpAction(formData: FormData): Promise<void> {
  const phone = normalizeIranianMobile(text(formData, "phone"));
  if (!phone) go("/account/otp", "error", "شماره موبایل ایرانی معتبر نیست.");
  if (!(await enforceRateLimit("phone-otp", phone, 5, 3600))) {
    go("/account/otp", "error", "تعداد درخواست کد زیاد است.");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await issueVerificationToken(database(), {
    identifier: phone,
    purpose: VERIFICATION_PURPOSES.phoneOtp,
    tokenHash: hashSecret(code),
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS.PHONE_OTP * 1000),
  });
  await createSmsProvider(loadEnvironment()).sendOtpSms({
    phoneE164: phone,
    code,
    validForMinutes: 5,
  });
  redirect(`/account/otp?phone=${encodeURIComponent(phone)}&sent=1`);
}

export async function verifyOtpAction(formData: FormData): Promise<void> {
  const phone = normalizeIranianMobile(text(formData, "phone"));
  const code = text(formData, "code");
  if (!phone || !/^\d{6}$/.test(code))
    go("/account/otp", "error", "کد واردشده معتبر نیست.");
  const result = await consumeVerificationToken(database(), {
    identifier: phone,
    purpose: VERIFICATION_PURPOSES.phoneOtp,
    tokenHash: hashSecret(code),
    now: new Date(),
  });
  if (result.outcome !== "consumed")
    go("/account/otp", "error", "کد اشتباه یا منقضی است.");
  const signedIn = await currentUser();
  if (signedIn) {
    const linked = await linkVerifiedPhone(database(), {
      userId: signedIn.id,
      phoneE164: phone,
      verifiedAt: new Date(),
    });
    if (!linked) go("/account", "error", "این شماره به حساب دیگری متصل است.");
    redirect("/account/profile");
  }
  const existing = await findUserByPhone(database(), phone);
  const user =
    existing ?? (await ensureCustomerByPhone(database(), { phoneE164: phone }));
  if (!user.phoneVerifiedAt) {
    await linkVerifiedPhone(database(), {
      userId: user.id,
      phoneE164: phone,
      verifiedAt: new Date(),
    });
  }
  await finishSignIn(user.id);
}
