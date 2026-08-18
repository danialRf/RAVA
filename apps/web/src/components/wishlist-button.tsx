import { toggleWishlistAction } from "../app/actions";
import { Icon } from "./icons";

/**
 * Wishlist toggle.
 *
 * Implemented as a plain form posting to a server action so it works without
 * client JavaScript and needs no bundle for a one-tap interaction.
 */
export function WishlistButton({
  slug,
  title,
  active,
}: {
  slug: string;
  title: string;
  active: boolean;
}) {
  return (
    <form action={toggleWishlistAction} className="wish-form">
      <input type="hidden" name="slug" value={slug} />
      <button
        className={`wish-button ${active ? "active" : ""}`}
        type="submit"
        aria-pressed={active}
        aria-label={
          active
            ? `حذف ${title} از علاقه‌مندی‌ها`
            : `افزودن ${title} به علاقه‌مندی‌ها`
        }
      >
        <Icon name="heart" width="20" />
      </button>
    </form>
  );
}
