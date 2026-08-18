# RAVA Champagne Editorial Refinement

Implemented on 2026-08-18 from the supplied beauty-editorial references.

## Design translation

The references share five useful traits: warm ivory space, white product canvases, champagne-metal details, restrained rose accents and thin editorial dividers. RAVA adopts those traits without copying product claims, layouts or brand assets.

## Palette roles

- Rose coral is the primary storefront action and editorial highlight color.
- Burgundy anchors the RAVA identity, pricing and high-contrast text.
- Champagne gold is the visible secondary color: announcement and trust surfaces, search framing, CTA panels, category tiles, card borders and editorial rules.
- Peach, powder rose and soft lilac translate the cosmetic-card backgrounds in the supplied references into a coordinated category system.
- Ink remains the body-text color. Light gold is never used for body copy because it cannot provide reliable contrast on ivory.

## Composition

- The home hero is now a contained peach editorial spread with a white product canvas, champagne outline, rose CTA and catalogue caption.
- Category tiles intentionally alternate gold, rose, lilac and peach instead of repeating neutral white cards.
- Product results use a white beauty-card treatment over pale-gold section panels, with a rose reveal line and clearer information hierarchy.
- Trust and sourcing sections use full-width color surfaces so the visual language remains noticeable beyond hover states.

## Typography

The site self-hosts `Vazirmatn Variable`, the official open-source continuation of Vazir under the SIL Open Font License. The variable weight is tuned for a slightly softer B Vazir-like Persian reading texture while preserving web performance and legal redistribution.

An actual third-party “B Vazir” binary was not bundled because no authoritative redistributable source or license was found in the supplied project or the local Windows fonts.

## Interaction rules

- Hover elevation is limited to 1–3 px and 180–220 ms.
- Cards communicate interactivity through border, shadow and movement together, not color alone.
- Fields receive an immediate gold focus halo.
- The mobile header remains in document flow so it cannot cover forms; sticky navigation is desktop-only.
- `prefers-reduced-motion` removes decorative transforms.

## Accessibility/performance basis

- Normal text targets WCAG AA contrast of 4.5:1; meaningful component boundaries target 3:1.
- Gold-deep is used whenever gold carries text meaning.
- Feedback remains immediate and CSS-only, adding no client JavaScript or animation dependency.
