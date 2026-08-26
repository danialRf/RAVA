import type { Metadata } from "next";
import {
  EmptyState,
  PageIntro,
  ProductGrid,
} from "../../../components/storefront";
import { listProductsBySlugs } from "../../../server/catalog";
import { readWishlist } from "../../../server/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "علاقه‌مندی‌ها",
  description: "محصولاتی که در این مرورگر نشان کرده‌اید.",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const slugs = await readWishlist();
  const products = await listProductsBySlugs(slugs);

  return (
    <div className="section-shell listing-page">
      <PageIntro
        eyebrow="علاقه‌مندی‌ها"
        title="نشان‌شده‌های شما"
        copy="این فهرست فعلاً روی همین مرورگر ذخیره می‌شود و پس از ساخت حساب به آن منتقل خواهد شد."
      />
      {products.length === 0 ? (
        <EmptyState
          title="هنوز چیزی نشان نکرده‌اید"
          copy="با زدن نشان روی هر محصول، این فهرست ساخته می‌شود."
        />
      ) : (
        <ProductGrid items={products} wishlist={slugs} />
      )}
    </div>
  );
}
