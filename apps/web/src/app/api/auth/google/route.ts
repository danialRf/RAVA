import { NextResponse } from "next/server";

import { loadEnvironment } from "@rava/config";
import { OAUTH_STATE_TTL_SECONDS } from "@rava/domain";

import { siteUrl, usesHttps } from "../../../../lib/site";
import { randomToken } from "../../../../server/auth";

const STATE_COOKIE = "rava_google_state";

export async function GET(): Promise<NextResponse> {
  const environment = loadEnvironment();
  if (!environment.AUTH_GOOGLE_ID || !environment.AUTH_GOOGLE_SECRET) {
    return NextResponse.redirect(
      new URL(
        "/account?error=ورود Google در این محیط پیکربندی نشده است.",
        siteUrl(),
      ),
    );
  }
  const state = randomToken(24);
  const callback = new URL("/api/auth/google/callback", siteUrl()).toString();
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.searchParams.set("client_id", environment.AUTH_GOOGLE_ID);
  authorization.searchParams.set("redirect_uri", callback);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("prompt", "select_account");
  const response = NextResponse.redirect(authorization);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return response;
}
