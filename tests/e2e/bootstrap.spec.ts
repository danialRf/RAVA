import { expect, test } from "@playwright/test";
import path from "node:path";

import { createDatabase, users } from "../../packages/db/src";
import { hashPassword } from "../../packages/integrations/src";

/**
 * Storefront end-to-end coverage.
 *
 * The suite runs against the production build with the seeded database, so it
 * exercises the real catalog queries, the estimate pricing service and the
 * Persian/RTL rendering rather than fixtures.
 */

const SEEDED_PRODUCT = "adidas-samba-og";

test("renders the Persian RTL storefront without browser errors", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa-IR");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "چیزی که دوست دارید",
  );
  await expect(
    page.getByRole("navigation", { name: "ناوبری موبایل" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "ناوبری موبایل" }).getByRole("link", {
      name: "سبد خرید",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
});

test("home shows database-backed catalog with estimated prices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const cards = page.locator(".product-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);

  // Public prices must always be labelled as estimates.
  await expect(page.getByText("قیمت تخمینی").first()).toBeVisible();
  await expect(page.getByText(/حدود [۰-۹٬]+ تومان/).first()).toBeVisible();

  // Category and brand strips come from the database, with real counts.
  await expect(
    page.getByRole("heading", { name: "دسته‌بندی‌ها" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "جدید در کاتالوگ" }),
  ).toBeVisible();
});

test("browses the listing, filters it and opens a product", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/category");

  const allCount = await page.locator(".product-card").count();
  expect(allCount).toBeGreaterThan(1);

  // The mobile filter drawer must be reachable, then narrow the result set.
  await page.getByRole("group").getByText("فیلترها").click();
  await page
    .locator(".filter-panel")
    .getByRole("link", { name: "کفش", exact: true })
    .click();
  await expect(page).toHaveURL(/type=footwear/);
  const filtered = await page.locator(".product-card").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(allCount);

  await page.locator(`a[href="/product/${SEEDED_PRODUCT}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/product/${SEEDED_PRODUCT}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("آدیداس");
});

test("product page states source, variants, price and deposit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${SEEDED_PRODUCT}`);

  await expect(page.locator(".purchase-column .source-badge")).toContainText(
    "فروشنده مجاز",
  );
  await expect(page.getByText(/حدود [۰-۹٬]+ تومان/).first()).toBeVisible();
  await expect(page.getByText("قیمت نهایی هنگام ثبت سفارش")).toBeVisible();

  // Every seeded size is offered, and the deposit is derived from the estimate.
  await expect(page.getByText("سایز ۴۲")).toBeVisible();
  await expect(page.getByText(/پیش‌پرداخت تخمینی/).first()).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("searches Persian and Latin terms and shows an honest empty state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Search starts directly inside the persistent header instead of sending
  // the visitor to a second page just to enter a query.
  await page.goto("/");
  const headerSearch = page.locator(".header-search");
  await headerSearch.getByRole("searchbox").fill("Samba");
  await headerSearch.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Samba$/);
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto("/search?q=Samba");
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto("/search?q=%D8%B3%D8%A7%D9%85%D8%A8%D8%A7");
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto("/search?q=zzzznotfound");
  await expect(page.getByText(/نتیجه‌ای نبود/)).toBeVisible();
  expect(await page.locator(".product-card").count()).toBe(0);
});

test("wishlist persists through the anonymous session", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${SEEDED_PRODUCT}`);

  const wishButton = page.locator(".pdp-actions button.wish-button");
  await wishButton.click();
  // The form posts to a server action; wait for the re-rendered state before
  // navigating, otherwise the request is aborted by the next navigation.
  await expect(wishButton).toHaveAttribute("aria-pressed", "true");

  await page.goto("/wishlist");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText("آدیداس");

  // Toggling again removes it, so the control is genuinely two-way. The
  // response to the action re-renders this same page, now empty.
  await page.locator(".product-card button.wish-button").first().click();
  await expect(page.getByText("هنوز چیزی نشان نکرده‌اید")).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(0);
});

test("records recently viewed products for the visitor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${SEEDED_PRODUCT}`);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "بازدیدهای اخیر شما" }),
  ).toBeVisible();
});

test("completes the customer account and private request journey", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `e2e-${suffix}@example.com`;
  const password = "A-secure-test-password-2026";

  // An anonymous selection must survive account creation.
  await page.goto(`/product/${SEEDED_PRODUCT}`);
  await page.locator(".pdp-actions button.wish-button").click();
  await expect(page.locator(".pdp-actions button.wish-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/account/register");
  await page.locator('input[name="displayName"]').fill("کاربر آزمایشی روا");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/);
  await expect(page.locator(".account-page")).toBeVisible();

  await page.goto("/wishlist");
  await expect(page.locator(".product-card")).toHaveCount(1);

  await page.goto("/account/profile");
  await page.locator('input[name="displayName"]').fill("مشتری آزمایشی روا");
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account\/profile\?notice=/);
  await expect(page.locator('input[name="displayName"]')).toHaveValue(
    "مشتری آزمایشی روا",
  );

  await page.goto("/account/addresses");
  await page.locator('input[name="recipientName"]').fill("مشتری آزمایشی");
  await page.locator('input[name="phone"]').fill("09123456789");
  await page.locator('input[name="province"]').fill("تهران");
  await page.locator('input[name="city"]').fill("تهران");
  await page
    .locator('textarea[name="addressLine"]')
    .fill("خیابان آزمایش، کوچه روا، پلاک ۱۰");
  await page.locator('input[name="postalCode"]').fill("1234567890");
  await page.locator('input[name="isDefault"]').check();
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account\/addresses\?notice=/);
  await expect(page.locator(".address-list article")).toHaveCount(1);
  await page.screenshot({
    path: "docs/phase-4-account-addresses-390x844.png",
    fullPage: true,
  });

  await page.goto("/find-it");
  await page
    .locator('textarea[name="description"]')
    .fill("کفش مشکی مدل آزمایشی با سایز ۴۲");
  await page
    .locator('input[name="referenceUrl"]')
    .fill("https://example.com/reference-product");
  await page.locator('input[name="budget"]').fill("5000000");
  await page.locator('input[name="phone"]').fill("09123456789");
  await page
    .locator('input[name="image"]')
    .setInputFiles(path.resolve("docs/phase-3-home-390x844.png"));
  await page.locator('.consent input[type="checkbox"]').check();
  await page.locator("form.request-form button").click();
  await expect(page).toHaveURL(/\/find-it\?notice=/);
  await expect(page.locator(".request-history article")).toHaveCount(1);
  await page.screenshot({
    path: "docs/phase-4-product-request-390x844.png",
    fullPage: true,
  });

  await page.goto("/account");
  await page.locator(".account-security form button").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/);
  await expect(
    page.getByRole("heading", { name: "سلام مشتری آزمایشی روا" }),
  ).toBeVisible();
});

test("locks a quote, pays the deposit and creates a trackable order", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `checkout-${suffix}@example.com`;
  const password = "A-secure-checkout-password-2026";

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${SEEDED_PRODUCT}`);
  await page.locator(".purchase-column form button.primary").click();
  await expect(page).toHaveURL(/\/cart\?notice=added/);
  await expect(page.getByText("۱ کالا")).toBeVisible();

  await page.goto("/account/register");
  await page.locator('input[name="displayName"]').fill("خریدار آزمایشی");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/);

  await page.goto("/account/addresses");
  await page.locator('input[name="recipientName"]').fill("خریدار آزمایشی");
  await page.locator('input[name="phone"]').fill("09123456789");
  await page.locator('input[name="province"]').fill("تهران");
  await page.locator('input[name="city"]').fill("تهران");
  await page
    .locator('textarea[name="addressLine"]')
    .fill("خیابان آزمایش، پلاک ۲۰");
  await page.locator('input[name="postalCode"]').fill("1234567890");
  await page.locator('input[name="isDefault"]').check();
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account\/addresses\?notice=/);

  await page.goto("/cart");
  await page.getByRole("button", { name: "دریافت قیمت قطعی" }).click();
  await expect(page).toHaveURL(/\/checkout\/quote\/[0-9a-f-]+/);
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("مبلغ قفل‌شده")).toBeVisible();
  await page.screenshot({
    path: "docs/phase-5-quote-390x844.png",
    fullPage: true,
  });

  // The customer leaves for the (simulated) bank, approves, and returns
  // through the callback exactly as a live gateway would route them.
  await page.getByRole("button", { name: "پرداخت با درگاه بانکی" }).click();
  await expect(page).toHaveURL(/\/checkout\/payment\/gateway\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", { name: "تأیید پیش‌پرداخت" }),
  ).toBeVisible();

  // If the customer closes the bank page, the pending order remains payable
  // and resumes the exact persisted payment intent instead of creating a
  // duplicate order or charging attempt.
  const gatewayUrl = page.url();
  const paymentId = new URL(gatewayUrl).pathname.split("/").at(-1);
  await page.goto("/account/orders");
  const pendingOrderLink = page.locator(".order-list > a").first();
  await pendingOrderLink.click();
  await page.getByRole("link", { name: "ادامه پرداخت آنلاین" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/checkout/payment/gateway/${paymentId}\\?authority=`),
  );

  await page.getByRole("button", { name: "پرداخت آزمایشی امن" }).click();
  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]+\?notice=paid/, {
    timeout: 20_000,
  });
  await expect(page.getByText("پیش‌پرداخت تأیید شد؛ در صف تهیه")).toBeVisible();
  await expect(page.getByText("خلاصه مالی")).toBeVisible();
  await page.screenshot({
    path: "docs/phase-5-order-390x844.png",
    fullPage: true,
  });

  const paidOrderUrl = page.url().replace(/\?.*$/, "");
  await page.goto("/account/orders");
  await expect(
    page.locator(`a[href="${new URL(paidOrderUrl).pathname}"]`),
  ).toBeVisible();
});

test("captures the account entry at mobile and desktop", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/login$/);

  for (const viewport of [
    { name: "390x844", width: 390, height: 844 },
    { name: "desktop-1440", width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/account/login");
    await expect(
      page.getByRole("navigation", { name: "ورود یا ثبت‌نام" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ورود", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "ورود با شماره موبایل" }),
    ).toHaveCount(0);
    if (viewport.width >= 768) {
      await expect(
        page
          .getByRole("navigation", { name: "ابزارهای فروشگاه" })
          .getByRole("link", {
            name: "سبد خرید",
          }),
      ).toBeVisible();
    }
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.screenshot({
      path: `docs/phase-4-account-login-${viewport.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("exposes the remaining storefront routes", async ({ page }) => {
  for (const route of [
    "/category",
    `/product/${SEEDED_PRODUCT}`,
    "/search",
    "/cart",
    "/account",
    "/authenticity",
    "/find-it",
    "/wishlist",
  ]) {
    const response = await page.goto(route);
    expect(response?.ok(), route).toBe(true);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("publishes a crawlable sitemap and robots policy", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Sitemap:");
  expect(robotsBody).toContain("/wishlist");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain(`/product/${SEEDED_PRODUCT}`);
});

test("protects the admin operating system from guests", async ({ page }) => {
  for (const route of [
    "/admin",
    "/admin/catalog",
    "/admin/offers",
    "/admin/pricing",
    "/admin/trips",
    "/admin/customers",
    "/admin/requests",
    "/admin/sources",
    "/admin/content",
    "/admin/health",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/account\/login\?next=%2Fadmin$/);
    await expect(page.locator(".admin-app")).toHaveCount(0);
  }
});

test("denies the admin operating system to customer accounts", async ({
  page,
}) => {
  const email = `rbac-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
  await page.goto("/account/register");
  await page.locator('input[name="displayName"]').fill("مشتری تست دسترسی");
  await page.locator('input[name="email"]').fill(email);
  await page
    .locator('input[name="password"]')
    .fill("A-secure-test-password-2026");
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator(".admin-app")).toHaveCount(0);
});

test("runs the complete Phase 6 admin workspace on mobile", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `owner-phase6-${suffix}@example.com`;
  const password = "A-secure-owner-password-2026";
  const handle = createDatabase();
  try {
    await handle.db.insert(users).values({
      email,
      displayName: "مدیر تست فاز شش",
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      role: "OWNER",
    });
  } finally {
    await handle.close();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account/login?next=%2Fadmin");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const route of [
    "/admin/catalog",
    "/admin/offers",
    "/admin/pricing",
    "/admin/trips",
    "/admin/customers",
    "/admin/requests",
    "/admin/sources",
    "/admin/content",
    "/admin/health",
  ]) {
    await page.goto(route);
    await expect(page.locator(".admin-page-header h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `${route} should not overflow horizontally`,
    ).toBe(true);
  }

  await page.goto("/admin/trips");
  await page.screenshot({
    path: "docs/phase-6-admin-trips-390x844.png",
    fullPage: true,
  });
});

for (const viewport of [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 1000 },
]) {
  test(`captures the home page at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.screenshot({
      path: `docs/phase-3-home-${viewport.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("captures key commerce pages at mobile and desktop", async ({ page }) => {
  for (const [name, route] of [
    ["listing", "/category"],
    ["product", `/product/${SEEDED_PRODUCT}`],
    ["search", "/search?q=Samba"],
  ] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.screenshot({
      path: `docs/phase-3-${name}-390x844.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.screenshot({
      path: `docs/phase-3-${name}-1440.png`,
      fullPage: true,
    });
  }
});

test("exposes a non-cached application health endpoint", async ({
  request,
}) => {
  const response = await request.get("/health");
  const body = (await response.json()) as {
    status: string;
    service: string;
    runtime: { providers: { fx: string; ai: string } };
  };
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(body).toMatchObject({
    status: "ok",
    service: "rava-web",
    runtime: { providers: { fx: "fake", ai: "disabled" } },
  });
});

/**
 * The card-to-card branch of the deposit.
 *
 * A fresh manual intent is created as INITIATED, so the receipt form must
 * accept an upload immediately and leave the order awaiting finance review
 * rather than crediting the deposit.
 */
test("uploads a card-to-card deposit receipt for review", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `card-${suffix}@example.com`;
  const password = "A-secure-checkout-password-2026";

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${SEEDED_PRODUCT}`);
  await page.locator(".purchase-column form button.primary").click();
  await expect(page).toHaveURL(/\/cart\?notice=added/);

  await page.goto("/account/register");
  await page.locator('input[name="displayName"]').fill("خریدار کارت‌به‌کارت");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/);

  await page.goto("/account/addresses");
  await page.locator('input[name="recipientName"]').fill("خریدار کارت‌به‌کارت");
  await page.locator('input[name="phone"]').fill("09123456789");
  await page.locator('input[name="province"]').fill("تهران");
  await page.locator('input[name="city"]').fill("تهران");
  await page
    .locator('textarea[name="addressLine"]')
    .fill("خیابان آزمایش، پلاک ۲۱");
  await page.locator('input[name="postalCode"]').fill("1234567890");
  await page.locator('input[name="isDefault"]').check();
  await page.locator("form.auth-form button").click();
  await expect(page).toHaveURL(/\/account\/addresses\?notice=/);

  await page.goto("/cart");
  await page.getByRole("button", { name: "دریافت قیمت قطعی" }).click();
  await expect(page).toHaveURL(/\/checkout\/quote\/[0-9a-f-]+/);

  await page.locator('button[name="method"][value="CARD_TO_CARD"]').click();
  await expect(page).toHaveURL(/\/checkout\/payment\/card\/[0-9a-f-]+/);
  await expect(
    page.getByRole("heading", { name: "ثبت رسید پرداخت" }),
  ).toBeVisible();

  await page
    .locator('input[name="receipt"]')
    .setInputFiles(path.resolve("docs/phase-3-home-390x844.png"));
  await page.locator("form.auth-form button").click();

  await expect(page).toHaveURL(
    /\/account\/orders\/[0-9a-f-]+\?notice=receipt/,
    {
      timeout: 20_000,
    },
  );

  // The receipt is only evidence: the order must still be awaiting the deposit.
  await expect(page.getByText("در انتظار پیش‌پرداخت")).toBeVisible();
  await page.screenshot({
    path: "docs/phase-5-card-receipt-390x844.png",
    fullPage: true,
  });
});
