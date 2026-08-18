import { NextResponse, type NextRequest } from "next/server";

import { usesHttps } from "./lib/site";

/**
 * Records recently viewed products.
 *
 * Server components may read cookies but not write them, so the visit is
 * recorded here on the response instead. This keeps the feature working with
 * no client JavaScript and no anonymous user rows in the database.
 */

const RECENT_COOKIE = "rava_recent";
const MAX_RECENT = 12;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const match = /^\/product\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  const slug = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
  if (slug === null || !SLUG_PATTERN.test(slug)) return response;

  const current = (request.cookies.get(RECENT_COOKIE)?.value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => SLUG_PATTERN.test(entry));

  if (current[0] === slug) return response;

  const next = [slug, ...current.filter((entry) => entry !== slug)].slice(
    0,
    MAX_RECENT,
  );

  response.cookies.set(RECENT_COOKIE, next.join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: usesHttps(),
  });

  return response;
}

export const config = {
  matcher: "/product/:slug",
};
