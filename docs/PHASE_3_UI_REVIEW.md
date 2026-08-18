# Phase 3 UI Review

Reviewed against the seeded database at 360×800, 390×844, 430×932, 768×1024
and 1440×1000, plus listing, product detail and search at mobile and desktop.

## Issues found and fixed

1. **Placeholder art carried fictional brand wordmarks** (high impact).
   The illustrations printed `NORD`, `LUMEN`, `DERMA LAB` and `ATELIER N`, so an
   Adidas product page displayed a competing wordmark. That asserts a product
   fact the catalog does not contain. The wordmarks were removed and replaced
   with a neutral `تصویر نمونه` label.
2. **Filters were unreachable on mobile** (high impact).
   The Phase 1 filter panel was `display: none` below the desktop breakpoint and
   the filter button pointed at an anchor that never opened anything. Replaced
   with a `<details>` drawer that needs no client JavaScript; on desktop the
   summary is hidden and the panel is a permanent column.
3. **Variant chips implied an interaction that did nothing.**
   The heading said "انتخاب مدل" and the chips looked selected. Renamed to
   "مدل‌های موجود" and styled as a plain list, because choosing a variant
   belongs to checkout in a later phase.
4. **Latin digits leaked into Persian labels.**
   Sizes and volumes arrive from retailers as `42` / `200`; they now render as
   `۴۲` / `۲۰۰` like every other number in the interface.
5. **Session cookies were dropped on non-HTTPS origins.**
   The `Secure` flag was tied to `NODE_ENV`, so the wishlist silently failed on
   a production build served over plain HTTP. It is now derived from the
   configured `APP_URL` scheme.

## Verified behaviour

- Every public price is labelled تخمینی, with the source observation date on
  the product page.
- Products with no verified, in-stock offer show an explicit unavailable state
  and an استعلام CTA instead of a number.
- Discount badges appear only where the observed source price in EUR actually
  fell; FX movement never produces one.
- Source wording reflects the stored trust tier and never claims physical
  authentication.
- No horizontal overflow at any tested width; no console errors or warnings.

## Known limitations

- Product imagery is still placeholder illustration pending rights-cleared
  photography.
- Cart, account and checkout remain presentation shells; Phase 3 did not touch
  them.
- Sorting by price uses the observed EUR source price; the UI states that basis
  next to the control.
