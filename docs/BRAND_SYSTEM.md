# RAVA Brand & UI System

## 1. Brand

English:
**RAVA**

Persian:
**روا**

Tagline:
**اصل، آن‌طور که باید باشد.**

Position:
Trusted, curated, approachable premium.

RAVA is not:
- an ultra-luxury boutique,
- a bargain-bin discount site,
- a tech startup,
- an AI company,
- a black/gold perfume page.

RAVA should feel like a thoughtful Iranian consumer brand with European sourcing discipline.

## 2. Personality

- calm,
- warm,
- confident,
- clear,
- contemporary,
- knowledgeable,
- not snobbish,
- not loud.

## 3. Visual direction

Use the existing warm cream / burgundy / editorial product references as tonal inspiration, but reduce their “luxury catalog” intensity.

The website should be:
- brighter,
- more useful,
- more ecommerce-native,
- more accessible,
- less gold,
- less black,
- more whitespace,
- more product photography.

## 4. Color tokens

Recommended initial tokens:

```css
--rava-ivory: #F7F3EC;
--rava-paper: #FFFDFC;
--rava-ink: #202123;
--rava-muted-ink: #67645F;
--rava-border: #E5DED4;
--rava-burgundy: #7A4050;
--rava-burgundy-dark: #60313E;
--rava-sage: #617168;
--rava-sage-soft: #E7ECE8;
--rava-sand: #D9CBB8;
--rava-gold: #C8AA70;
--rava-gold-soft: #F3EAD8;
--rava-gold-pale: #FBF6EB;
--rava-gold-deep: #70552A;
--rava-sale-soft: #F4E6E8;
--rava-warning: #9A6B35;
--rava-success: #3F6654;
--rava-error: #A43D43;
```

Usage:
- 55–65% warm paper/ivory,
- 20–30% ink/text,
- 5–10% sage,
- 3–6% burgundy,
- champagne gold/sand only as secondary detail: hairlines, focus, selected states and subtle elevation.

Do not use gold as a dominant UI color or low-contrast body text. Light gold must pair with a dark ink/gold-deep foreground.

## 5. Typography

Launch default:
**Vazirmatn Variable** for Persian UI. It is the official open-source continuation of Vazir and the legally distributable web-safe choice for the requested B Vazir character.

Optional later, once legally licensed:
**Peyda** may replace or complement headline/body roles.

Latin product names:
- use a clean neutral sans such as Inter,
- never retype or translate official brand/model spelling.

Rules:
- body minimum 14–16px equivalent,
- comfortable line height,
- strong numeric legibility,
- Persian price numbers can use Persian digits,
- SKU/EAN/model codes remain LTR.

## 6. Shape language

- primary card radius: 14px,
- small controls: 10–12px,
- drawers/sheets: 20px at top corners on mobile,
- not every element is pill-shaped,
- borders are often better than shadows,
- shadow is subtle and only for elevated states.

## 7. Motion

- 150–220ms normal transitions,
- ease-out for entering,
- no dramatic parallax,
- no constant floating animation,
- respect `prefers-reduced-motion`.

## 8. Photography

Commerce images must show the real product clearly.

Preferred:
- official/product source image where usage permits,
- clean cutout or simple studio background,
- high-resolution,
- consistent aspect ratio,
- no fake props that change perceived package/product.

Generated/editorial campaign visuals may be used later, but:
- never replace factual product imagery,
- never show a variant the customer is not ordering,
- never imply accessories are included if they are not.

## 9. Home-page visual hierarchy

Suggested mobile-first order:

1. compact announcement / next-trip strip,
2. header + search,
3. warm editorial hero,
4. trust/source strip,
5. category icons/cards,
6. “فرصت‌های آلمان” product rail,
7. “چرا روا؟” source/authenticity explainer,
8. next trip/drop card,
9. popular brands,
10. request-a-product CTA,
11. editorial content,
12. footer.

Hero should not consume the entire first screen on mobile.

## 10. Product card

Show:
- photo,
- brand,
- product/model,
- variant summary,
- estimated Toman price,
- source price in EUR optionally,
- discount when factual,
- source badge,
- arrival/trip label,
- wishlist.

Avoid:
- 8 badges,
- giant percentage badge,
- fake urgency,
- dense descriptive text.

Example price:
`حدود ۸٬۹۵۰٬۰۰۰ تومان`

Under it:
`قیمت نهایی هنگام ثبت سفارش محاسبه می‌شود`

## 11. Product detail trust block

Near the buy action, not buried in footer:

- source name,
- source trust tier,
- “مدرک خرید پس از تهیه ثبت می‌شود”,
- estimated delivery window,
- deposit percentage,
- quote explanation.

## 12. Language

Brand voice:
- factual,
- warm,
- concise.

Good:
“از Douglas آلمان تهیه می‌شود.”
“قیمت نهایی با نرخ لحظه‌ای هنگام ثبت سفارش محاسبه می‌شود.”
“تحویل تقریبی: ۲ تا ۶ ماه.”

Bad:
“واااای این آفر رو از دست ندید!”
“۱۰۰٪ اورجینال تضمینییی!”
“ارزان‌ترین قیمت ایران!”

## 13. Accessibility

- visible focus ring,
- 44px touch targets,
- never encode status by color alone,
- color contrast must pass,
- form errors adjacent to fields,
- bottom sheets reachable by screen reader/keyboard.

## 14. “Human-made” design guardrail

Before accepting a page, ask:
- Does this look like a real retail brand?
- Is every visual treatment serving shopping?
- Would removing 30% of decoration improve it?
- Is the mobile first screen immediately useful?
- Are typography and spacing consistent?
- Did we accidentally produce generic AI/SaaS aesthetics?

If yes to the last question, redesign before shipping.
