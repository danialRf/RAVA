import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { loadEnvironment } from "@rava/config";
import {
  createVerifiedProviderUser,
  findUserByEmail,
  findUserIdByProviderAccount,
  linkProviderAccount,
} from "@rava/db";
import { normalizeEmail } from "@rava/domain";

import { siteUrl } from "../../../../../lib/site";
import { createAuthSession } from "../../../../../server/auth";
import { database } from "../../../../../server/db";
import { migrateAnonymousWishlist } from "../../../../../server/session";

const STATE_COOKIE = "rava_google_state";

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function fail(message: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/account?error=${encodeURIComponent(message)}`, siteUrl()),
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const environment = loadEnvironment();
  if (!environment.AUTH_GOOGLE_ID || !environment.AUTH_GOOGLE_SECRET)
    return fail("ورود Google غیرفعال است.");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const expected = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!state || !expected || !safeEqual(state, expected) || !code)
    return fail("پاسخ Google معتبر نیست.");

  const callback = new URL("/api/auth/google/callback", siteUrl()).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: environment.AUTH_GOOGLE_ID,
      client_secret: environment.AUTH_GOOGLE_SECRET,
      redirect_uri: callback,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return fail("ارتباط امن با Google کامل نشد.");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return fail("Google توکن ورود برنگرداند.");
  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    },
  );
  if (!profileResponse.ok) return fail("هویت Google قابل بررسی نبود.");
  const profile = (await profileResponse.json()) as GoogleUserInfo;
  if (!profile.sub || !profile.email || profile.email_verified !== true)
    return fail("ایمیل Google تأییدشده نیست.");

  const linkedId = await findUserIdByProviderAccount(database(), {
    provider: "google",
    providerAccountId: profile.sub,
  });
  let userId = linkedId;
  if (!userId) {
    const email = normalizeEmail(profile.email);
    const existing = await findUserByEmail(database(), email);
    if (existing && !existing.emailVerifiedAt) {
      return fail(
        "برای اتصال Google ابتدا با گذرواژه وارد شوید و ایمیل را تأیید کنید.",
      );
    }
    const user =
      existing ??
      (await createVerifiedProviderUser(database(), {
        email,
        displayName: profile.name?.slice(0, 80) ?? null,
        verifiedAt: new Date(),
      }));
    if (!user) return fail("ساخت حساب Google کامل نشد.");
    userId = user.id;
    await linkProviderAccount(database(), {
      userId,
      provider: "google",
      providerAccountId: profile.sub,
      scope: "openid email profile",
    });
  }
  await createAuthSession(userId);
  await migrateAnonymousWishlist(userId);
  const response = NextResponse.redirect(new URL("/account", siteUrl()));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
