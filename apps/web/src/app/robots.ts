import type { MetadataRoute } from "next";

import { siteUrl } from "../lib/site";

/** Account, wishlist and search result pages are private or thin, so they
 * stay out of the index while the catalog itself is crawlable. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl().replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/wishlist", "/cart", "/search"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
