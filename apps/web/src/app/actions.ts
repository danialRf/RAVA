"use server";

import { revalidatePath } from "next/cache";

import { toggleWishlist } from "../server/session";

/**
 * Adds or removes a product from the anonymous wishlist.
 *
 * The slug is validated against the cookie format before it is stored, so a
 * crafted form post cannot write arbitrary content into the visitor's cookie.
 */
export async function toggleWishlistAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return;

  await toggleWishlist(slug);
  revalidatePath("/wishlist");
}
