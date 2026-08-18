import "server-only";

import { cookies } from "next/headers";

import {
  listWishlistProducts,
  replaceWishlistFromSlugs,
  toggleUserWishlist,
} from "@rava/db";

import { usesHttps } from "../lib/site";
import { currentUser } from "./auth";
import { database } from "./db";

/**
 * Anonymous browsing state.
 *
 * Until accounts exist (Phase 4) the wishlist and recently-viewed lists live in
 * the visitor's own cookies: no user rows are invented, nothing is written to
 * the database, and clearing cookies clears the state. When authentication
 * lands, these lists migrate into `wishlists` / `recently_viewed` for the
 * signed-in user.
 */

const WISHLIST_COOKIE = "rava_wishlist";
const RECENT_COOKIE = "rava_recent";
const MAX_WISHLIST = 50;
const MAX_RECENT = 12;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Slugs are stored comma separated; anything unexpected is dropped. */
function parseSlugs(value: string | undefined, max: number): string[] {
  if (value === undefined || value === "") return [];
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug))
    .slice(0, max);
}

function serialize(slugs: readonly string[]): string {
  return slugs.join(",");
}

export async function readWishlist(): Promise<readonly string[]> {
  const user = await currentUser();
  if (user) {
    return (await listWishlistProducts(database(), user.id)).map(
      ({ slug }) => slug,
    );
  }
  const store = await cookies();
  return parseSlugs(store.get(WISHLIST_COOKIE)?.value, MAX_WISHLIST);
}

export async function readRecentlyViewed(): Promise<readonly string[]> {
  const store = await cookies();
  return parseSlugs(store.get(RECENT_COOKIE)?.value, MAX_RECENT);
}

/** Adds or removes a slug and reports the resulting membership. */
export async function toggleWishlist(slug: string): Promise<boolean> {
  const user = await currentUser();
  if (user) {
    return toggleUserWishlist(database(), {
      userId: user.id,
      productSlug: slug,
    });
  }
  const store = await cookies();
  const current = parseSlugs(store.get(WISHLIST_COOKIE)?.value, MAX_WISHLIST);
  const exists = current.includes(slug);
  const next = exists
    ? current.filter((entry) => entry !== slug)
    : [slug, ...current].slice(0, MAX_WISHLIST);

  store.set(WISHLIST_COOKIE, serialize(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    secure: usesHttps(),
  });

  return !exists;
}

/** Copies browser-local wishlist entries after sign-in without deleting either side. */
export async function migrateAnonymousWishlist(userId: string): Promise<void> {
  const store = await cookies();
  const slugs = parseSlugs(store.get(WISHLIST_COOKIE)?.value, MAX_WISHLIST);
  await replaceWishlistFromSlugs(database(), userId, slugs);
  store.delete(WISHLIST_COOKIE);
}

// Recording a view happens in `src/proxy.ts`: server components are allowed to
// read cookies but not write them.
