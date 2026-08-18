import type { MetadataRoute } from "next";

import { listCategories, listProducts } from "../server/catalog";
import { siteUrl } from "../lib/site";

export const dynamic = "force-dynamic";

/** Only published catalog entries are listed; nothing private or filtered. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().replace(/\/$/, "");
  const [products, categories] = await Promise.all([
    listProducts({ limit: 200 }),
    listCategories(),
  ]);

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/category`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/authenticity`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/find-it`, changeFrequency: "monthly", priority: 0.5 },
    ...categories.map((category) => ({
      url: `${base}/category?type=${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
