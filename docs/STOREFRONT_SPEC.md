# Storefront Specification

Persian-first, RTL, mobile-first.

## Navigation

Mobile bottom nav:
- خانه
- دسته‌بندی
- جست‌وجو
- علاقه‌مندی
- حساب من

Desktop:
header with search, categories, account, wishlist, cart.

## Home

Required sections:
- next trip/drop compact strip,
- search,
- editorial hero,
- trust/source explainer,
- categories,
- Germany deals,
- newly added,
- popular brands,
- next trip/order window,
- “برام پیدا کن” CTA,
- educational/editorial content.

All content manageable from admin.

## Search

V1:
- product/brand/model search,
- Persian/Latin tolerant matching,
- category,
- brand,
- price,
- discount,
- source,
- availability,
- arrival/trip.

Later:
- typo tolerance,
- saved searches,
- personalization.

## Category/listing

Mobile filter drawer.
Sticky sort/filter controls.

Sort:
- پیشنهادی
- جدیدترین
- بیشترین تخفیف
- قیمت کم به زیاد
- قیمت زیاد به کم
- زودترین تحویل

Do not sort by estimated Toman without indicating rate basis.

## Product detail

Above fold:
- product gallery,
- brand/product,
- variant selector,
- source,
- estimated price,
- discount if factual,
- deposit info,
- expected arrival,
- primary CTA.

Trust/provenance:
- source name,
- trust tier customer wording,
- evidence policy,
- price-observed timestamp,
- return/cancellation summary.

Sections:
- product information,
- variant details,
- source & purchase process,
- delivery timeline,
- price explanation,
- questions/reviews,
- related products,
- price history later.

## CTA states

Possible:
- ثبت سفارش
- استعلام قیمت
- رزرو با پیش‌پرداخت
- موجود در ایران
- ناموجود
- خبرم کن
- بررسی درخواست ویژه

## Cart

Group by:
- ready stock,
- preorder/source,
- trip eligibility where relevant.

Warn when items may have different delivery windows.

## Checkout

Steps:
1. account/contact,
2. address,
3. quote refresh,
4. deposit/payment method,
5. final review,
6. payment.

Show countdown for quote validity.

If quote expires:
- preserve cart,
- refresh price,
- clearly show difference before payment.

## Payments

Methods:
- Iranian gateway,
- card-to-card receipt upload.

Never display crypto.

## Account

Dashboard cards:
- current orders,
- balance due,
- next milestone,
- alerts.

Order detail:
- status timeline,
- items,
- fixed total,
- deposit paid,
- balance,
- trip,
- source documentation visible to customer,
- support.

## Find-it-for-me

Friendly form with image/link upload.

Keep it simple on mobile.

## Wishlist/alerts

One-tap wishlist.
Alert UI:
- price,
- source price,
- stock,
- size.

## Authenticity page

Explain:
- how sources are categorized,
- what “source verified” means,
- what purchase evidence is saved,
- what RAVA guarantee means,
- limitations honestly.

## Error/empty/loading

Design all:
- no search results,
- no offers,
- FX unavailable,
- quote expired,
- payment failed,
- card receipt pending,
- source out of stock,
- order reconfirmation needed.

No generic “Something went wrong” when a useful Persian explanation is possible.
