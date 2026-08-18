/**
 * Development seed.
 *
 * The data here is explicitly demo data: retailers, offers and prices are
 * illustrative, not scraped facts. It exists so the storefront, admin and
 * pricing work can be developed against a realistic Persian/RTL dataset.
 *
 * The script is idempotent: every insert is keyed on a natural unique column,
 * so it is safe to re-run. Offers are refreshed rather than skipped, so an
 * existing local database always reflects the current demo data.
 */

import {
  applyBps,
  convertEurCentsToToman,
  depositAmount,
  parseEurToCents,
  roundUpToUnit,
} from "@rava/domain";
import { eq, sql } from "drizzle-orm";

import { createDatabase, type Database } from "./client";
import {
  brands,
  categories,
  contentEntries,
  featureFlags,
  fxRates,
  offerPriceHistory,
  orderItems,
  orderStatusHistory,
  orders,
  pricingRules,
  productMedia,
  productVariants,
  products,
  quoteItems,
  quotes,
  retailerSellers,
  retailers,
  sourceOffers,
  trips,
  users,
} from "./schema";

const CALCULATION_VERSION = "phase-2-demo";
const DEMO_FX_TOMAN_PER_EUR = 200_000n;

interface SeedCounts {
  readonly [entity: string]: number;
}

async function seedFxRate(db: Database) {
  const providerTimestamp = new Date();
  const [rate] = await db
    .insert(fxRates)
    .values({
      provider: "fake",
      baseCurrency: "EUR",
      quoteCurrency: "TOMAN",
      side: "SELL",
      tomanPerUnit: DEMO_FX_TOMAN_PER_EUR,
      providerTimestamp,
      rawReference: { note: "deterministic development rate" },
    })
    .returning();
  if (rate === undefined) throw new Error("Failed to seed the FX rate");
  return rate;
}

async function seedTaxonomy(db: Database) {
  const categoryRows = [
    {
      nameFa: "زیبایی و مراقبت",
      nameEn: "Beauty & Care",
      slug: "beauty",
      sortOrder: 10,
      defaultTransportClass: "XS" as const,
      maxWeightGrams: 2_000,
    },
    {
      nameFa: "عطر",
      nameEn: "Fragrance",
      slug: "fragrance",
      sortOrder: 20,
      defaultTransportClass: "S" as const,
      maxWeightGrams: 1_500,
    },
    {
      nameFa: "کفش",
      nameEn: "Footwear",
      slug: "footwear",
      sortOrder: 30,
      defaultTransportClass: "M" as const,
      maxWeightGrams: 3_000,
    },
    {
      nameFa: "کیف و اکسسوری",
      nameEn: "Bags & Accessories",
      slug: "bags",
      sortOrder: 40,
      defaultTransportClass: "M" as const,
      maxWeightGrams: 4_000,
    },
  ];

  await db.insert(categories).values(categoryRows).onConflictDoNothing({
    target: categories.slug,
  });

  const brandRows = [
    { name: "Cerave", slug: "cerave", country: "DE" },
    { name: "Lancôme", slug: "lancome", country: "FR" },
    { name: "Adidas", slug: "adidas", country: "DE" },
    { name: "Samsonite", slug: "samsonite", country: "DE" },
    { name: "Nivea", slug: "nivea", country: "DE" },
  ];

  await db.insert(brands).values(brandRows).onConflictDoNothing({
    target: brands.slug,
  });

  const [categoryList, brandList] = await Promise.all([
    db.select().from(categories),
    db.select().from(brands),
  ]);

  const categoryBySlug = new Map(categoryList.map((row) => [row.slug, row]));
  const brandBySlug = new Map(brandList.map((row) => [row.slug, row]));
  return { categoryBySlug, brandBySlug };
}

interface DemoProduct {
  readonly slug: string;
  readonly titleFa: string;
  readonly titleOriginal: string;
  readonly brandSlug: string;
  readonly categorySlug: string;
  readonly descriptionFa: string;
  readonly weightGrams: number;
  readonly transportClass: "XS" | "S" | "M" | "L";
  readonly image: string;
  readonly variants: readonly {
    readonly sku: string;
    readonly size?: string;
    readonly color?: string;
    readonly volumeMl?: number;
  }[];
  readonly offerEur: string;
  readonly shippingEur: string;
  /** Only set where the demo story is a real observed price drop. */
  readonly previousOfferEur?: string;
}

const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    slug: "cerave-hydrating-cleanser-473",
    titleFa: "پاک‌کننده آبرسان سراوی ۴۷۳ میلی‌لیتر",
    titleOriginal: "CeraVe Hydrating Cleanser 473 ml",
    brandSlug: "cerave",
    categorySlug: "beauty",
    descriptionFa:
      "پاک‌کننده ملایم صورت برای پوست معمولی تا خشک. اطلاعات ترکیبات فقط از بسته‌بندی رسمی محصول درج می‌شود.",
    weightGrams: 520,
    transportClass: "XS",
    image: "/products/serum.svg",
    variants: [{ sku: "RAVA-CRV-CLN-473", volumeMl: 473 }],
    offerEur: "14.99",
    shippingEur: "3.99",
  },
  {
    slug: "lancome-la-vie-est-belle-50",
    titleFa: "عطر لانکوم لاوی ای بل ۵۰ میلی‌لیتر",
    titleOriginal: "Lancôme La Vie Est Belle EDP 50 ml",
    brandSlug: "lancome",
    categorySlug: "fragrance",
    descriptionFa:
      "ادو پرفیوم زنانه. حجم و اصالت بر اساس فاکتور خرید از فروشنده بررسی‌شده ثبت می‌شود.",
    weightGrams: 380,
    transportClass: "S",
    image: "/products/perfume.svg",
    variants: [{ sku: "RAVA-LNC-LVEB-50", volumeMl: 50 }],
    offerEur: "84.50",
    shippingEur: "4.90",
    previousOfferEur: "98.00",
  },
  {
    slug: "adidas-samba-og",
    titleFa: "کفش آدیداس سامبا او جی",
    titleOriginal: "Adidas Samba OG",
    brandSlug: "adidas",
    categorySlug: "footwear",
    descriptionFa:
      "کفش روزمره با رویه چرمی. سایز بر اساس جدول اندازه سازنده اعلام می‌شود.",
    weightGrams: 950,
    transportClass: "M",
    image: "/products/sneaker.svg",
    variants: [
      { sku: "RAVA-ADI-SMB-41", size: "41", color: "سفید/مشکی" },
      { sku: "RAVA-ADI-SMB-42", size: "42", color: "سفید/مشکی" },
      { sku: "RAVA-ADI-SMB-43", size: "43", color: "سفید/مشکی" },
    ],
    offerEur: "109.95",
    shippingEur: "0.00",
  },
  {
    slug: "samsonite-respark-cabin",
    titleFa: "چمدان کابین سامسونایت ری‌اسپارک",
    titleOriginal: "Samsonite Respark Spinner 55",
    brandSlug: "samsonite",
    categorySlug: "bags",
    descriptionFa:
      "چمدان کابین چهارچرخ. وزن و ابعاد دقیق پیش از سفر بازبینی می‌شود.",
    weightGrams: 2_600,
    transportClass: "M",
    image: "/products/bag.svg",
    variants: [{ sku: "RAVA-SMS-RSP-55", color: "خاکستری" }],
    offerEur: "179.00",
    shippingEur: "0.00",
  },
  {
    slug: "nivea-sun-protect-50",
    titleFa: "کرم ضدآفتاب نیوآ سان اس‌پی‌اف ۵۰",
    titleOriginal: "NIVEA SUN Protect & Moisture SPF 50",
    brandSlug: "nivea",
    categorySlug: "beauty",
    descriptionFa:
      "ضدآفتاب بدن با بافت سبک. میزان محافظت طبق درج سازنده روی بسته‌بندی است.",
    weightGrams: 260,
    transportClass: "XS",
    image: "/products/serum.svg",
    variants: [{ sku: "RAVA-NIV-SUN-200", volumeMl: 200 }],
    offerEur: "9.49",
    shippingEur: "3.99",
    previousOfferEur: "12.99",
  },
  {
    slug: "adidas-gazelle-indoor",
    titleFa: "کفش آدیداس گزل ایندور",
    titleOriginal: "Adidas Gazelle Indoor",
    brandSlug: "adidas",
    categorySlug: "footwear",
    descriptionFa:
      "کفش کلاسیک با رویه جیر. سایز بر اساس جدول اندازه سازنده اعلام می‌شود.",
    weightGrams: 900,
    transportClass: "M",
    image: "/products/sneaker.svg",
    variants: [
      { sku: "RAVA-ADI-GZL-40", size: "40", color: "سرمه‌ای" },
      { sku: "RAVA-ADI-GZL-42", size: "42", color: "سرمه‌ای" },
    ],
    offerEur: "119.95",
    shippingEur: "0.00",
  },
  {
    slug: "lancome-idole-aura-50",
    titleFa: "عطر لانکوم ایدول اورا ۵۰ میلی‌لیتر",
    titleOriginal: "Lancôme Idôle Aura EDP 50 ml",
    brandSlug: "lancome",
    categorySlug: "fragrance",
    descriptionFa:
      "ادو پرفیوم زنانه با رایحه گلی. اصالت پس از تهیه با فاکتور خرید ثبت می‌شود.",
    weightGrams: 360,
    transportClass: "S",
    image: "/products/perfume.svg",
    variants: [{ sku: "RAVA-LNC-IDA-50", volumeMl: 50 }],
    offerEur: "92.00",
    shippingEur: "4.90",
  },
  {
    slug: "samsonite-city-backpack",
    titleFa: "کوله‌پشتی سامسونایت سیتی",
    titleOriginal: "Samsonite City Backpack 15.6",
    brandSlug: "samsonite",
    categorySlug: "bags",
    descriptionFa:
      "کوله‌پشتی با جای لپ‌تاپ. ابعاد داخلی پیش از سفر بازبینی می‌شود.",
    weightGrams: 1_100,
    transportClass: "M",
    image: "/products/bag.svg",
    variants: [{ sku: "RAVA-SMS-CTY-15", color: "مشکی" }],
    offerEur: "74.90",
    shippingEur: "0.00",
  },
];

async function seedCatalog(
  db: Database,
  taxonomy: Awaited<ReturnType<typeof seedTaxonomy>>,
) {
  for (const demo of DEMO_PRODUCTS) {
    const brand = taxonomy.brandBySlug.get(demo.brandSlug);
    const category = taxonomy.categoryBySlug.get(demo.categorySlug);
    if (brand === undefined || category === undefined) {
      throw new Error(`Missing taxonomy for ${demo.slug}`);
    }

    await db
      .insert(products)
      .values({
        brandId: brand.id,
        categoryId: category.id,
        titleFa: demo.titleFa,
        titleOriginal: demo.titleOriginal,
        slug: demo.slug,
        descriptionFa: demo.descriptionFa,
        status: "PUBLISHED",
        weightGrams: demo.weightGrams,
        transportClass: demo.transportClass,
        productType: "PHYSICAL",
        publishedAt: new Date(),
      })
      .onConflictDoNothing({ target: products.slug });

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.slug, demo.slug))
      .limit(1);
    if (product === undefined) throw new Error(`Product ${demo.slug} missing`);

    await db
      .insert(productVariants)
      .values(
        demo.variants.map((variant) => ({
          productId: product.id,
          skuInternal: variant.sku,
          size: variant.size ?? null,
          color: variant.color ?? null,
          volumeMl: variant.volumeMl ?? null,
          status: "ACTIVE" as const,
        })),
      )
      .onConflictDoNothing({ target: productVariants.skuInternal });

    const [existingMedia] = await db
      .select({ id: productMedia.id })
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .limit(1);

    if (existingMedia === undefined) {
      await db.insert(productMedia).values({
        productId: product.id,
        kind: "PRIMARY",
        sourceUrl: demo.image,
        altTextFa: demo.titleFa,
        sortOrder: 0,
        sourceAttribution: "RAVA demo illustration",
        rightsNotes: "Placeholder artwork created for development only.",
      });
    }
  }
}

async function seedRetailers(db: Database) {
  await db
    .insert(retailers)
    .values([
      {
        name: "RAVA Demo Retailer",
        domain: "demo-retailer.example",
        country: "DE",
        trustTier: "AUTHORIZED_RETAILER" as const,
        isEnabled: true,
        crawlPolicy: { maxRequestsPerMinute: 10 },
        defaultIntervalMinutes: 180,
        termsNotes: "Fictional retailer used for local development only.",
      },
      {
        name: "RAVA Demo Marketplace",
        domain: "demo-marketplace.example",
        country: "DE",
        trustTier: "TRUSTED_MARKETPLACE" as const,
        isEnabled: true,
        crawlPolicy: { maxRequestsPerMinute: 6 },
        defaultIntervalMinutes: 240,
        termsNotes: "Marketplace offers require seller-level review.",
      },
    ])
    .onConflictDoNothing({ target: retailers.domain });

  const retailerList = await db.select().from(retailers);
  const byDomain = new Map(retailerList.map((row) => [row.domain, row]));
  const marketplace = byDomain.get("demo-marketplace.example");
  if (marketplace !== undefined) {
    await db
      .insert(retailerSellers)
      .values({
        retailerId: marketplace.id,
        externalSellerId: "demo-seller-1",
        sellerName: "Demo Seller",
        // Unreviewed marketplace sellers must stay in review, not be approved.
        trustStatus: "PENDING_REVIEW",
        reviewNotes: "Seeded in review state; no provenance evidence exists.",
      })
      .onConflictDoNothing({
        target: [retailerSellers.retailerId, retailerSellers.externalSellerId],
      });
  }

  return byDomain;
}

async function seedOffers(
  db: Database,
  retailerByDomain: Map<string, { id: string }>,
) {
  const retailer = retailerByDomain.get("demo-retailer.example");
  if (retailer === undefined) throw new Error("Demo retailer missing");

  for (const demo of DEMO_PRODUCTS) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.slug, demo.slug))
      .limit(1);
    if (product === undefined) continue;

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id));

    for (const variant of variants) {
      const sourceUrl = `https://demo-retailer.example/p/${variant.skuInternal.toLowerCase()}`;
      const price = parseEurToCents(demo.offerEur);
      const shipping = parseEurToCents(demo.shippingEur);
      const previousPrice =
        demo.previousOfferEur === undefined
          ? null
          : parseEurToCents(demo.previousOfferEur);

      await db
        .insert(sourceOffers)
        .values({
          retailerId: retailer.id,
          externalOfferId: variant.skuInternal,
          sourceUrl,
          productVariantId: variant.id,
          rawTitle: demo.titleOriginal,
          sourcePriceEurCents: price,
          previousPriceEurCents: previousPrice,
          shippingEurCents: shipping,
          stockStatus: "IN_STOCK",
          stockQuantity: 5,
          sourceIdentifiers: { sku: variant.skuInternal },
          sourceImageUrls: [demo.image],
          sourceVerified: true,
        })
        // Demo offers are refreshed on every run so an existing local database
        // picks up changes to the seed data instead of keeping stale values.
        .onConflictDoUpdate({
          target: [sourceOffers.retailerId, sourceOffers.sourceUrl],
          set: {
            sourcePriceEurCents: price,
            previousPriceEurCents: previousPrice,
            shippingEurCents: shipping,
            stockStatus: "IN_STOCK",
            sourceVerified: true,
            updatedAt: new Date(),
          },
        });

      const [offer] = await db
        .select()
        .from(sourceOffers)
        .where(eq(sourceOffers.sourceUrl, sourceUrl))
        .limit(1);
      if (offer === undefined) continue;

      const [history] = await db
        .select({ id: offerPriceHistory.id })
        .from(offerPriceHistory)
        .where(eq(offerPriceHistory.offerId, offer.id))
        .limit(1);

      if (history === undefined) {
        await db.insert(offerPriceHistory).values({
          offerId: offer.id,
          priceEurCents: price,
          shippingEurCents: shipping,
          stockStatus: "IN_STOCK",
        });
      }
    }
  }
}

async function seedPricingRules(
  db: Database,
  taxonomy: Awaited<ReturnType<typeof seedTaxonomy>>,
) {
  const [existing] = await db
    .select({ id: pricingRules.id })
    .from(pricingRules)
    .where(eq(pricingRules.scope, "GLOBAL"))
    .limit(1);
  if (existing !== undefined) return;

  const launchDefaults = {
    // 22% target margin, 3.5% payment fee, 35% deposit — the launch defaults
    // from docs/PRICING_ENGINE.md.
    targetMarginBps: 2_200,
    minProfitToman: 300_000n,
    customsRiskBps: 400,
    fxBufferBps: 250,
    paymentFeeBps: 350,
    depositBps: 3_500,
    minDepositToman: 500_000n,
    roundingUnitToman: 10_000n,
  } as const;

  await db.insert(pricingRules).values({
    ...launchDefaults,
    scope: "GLOBAL",
    priority: 0,
    transportClass: "M",
    notes: "Development default rule.",
  });

  // Light categories travel cheaper and carry a lower absolute profit floor.
  const lightCategories = [
    { slug: "beauty", transportClass: "XS" as const },
    { slug: "fragrance", transportClass: "S" as const },
  ];

  for (const entry of lightCategories) {
    const category = taxonomy.categoryBySlug.get(entry.slug);
    if (category === undefined) continue;
    await db.insert(pricingRules).values({
      ...launchDefaults,
      scope: "CATEGORY",
      categoryId: category.id,
      priority: 10,
      transportClass: entry.transportClass,
      minProfitToman: 200_000n,
      notes: `Category rule for ${entry.slug}.`,
    });
  }
}

async function seedFeatureFlags(db: Database) {
  await db
    .insert(featureFlags)
    .values([
      {
        key: "checkout.instant_quote",
        description: "Allow instant checkout quotes when FX is fresh.",
        isEnabled: true,
      },
      {
        key: "catalog.regulated_categories",
        description: "Expose categories that require manual review.",
        isEnabled: false,
      },
      {
        key: "telegram.publication",
        description: "Publish approved products to Telegram.",
        isEnabled: false,
      },
    ])
    .onConflictDoNothing({ target: featureFlags.key });
}

/**
 * Editorial copy for the storefront.
 *
 * The pages read these entries instead of hard-coding marketing text, so the
 * admin can own the wording in a later phase without touching components.
 */
async function seedContent(db: Database) {
  const entries = [
    {
      key: "home.hero",
      title: "چیزی که دوست دارید، از منبعی که می‌شناسید.",
      body: {
        eyebrow: "انتخاب‌های آلمان، با مسیر روشن",
        lead: "روا خرید از فروشگاه‌های منتخب آلمان را با قیمت تخمینی شفاف، پیش‌پرداخت و پیگیری مرحله‌به‌مرحله ساده می‌کند.",
        primaryCtaLabel: "دیدن انتخاب‌ها",
        primaryCtaHref: "/category",
      },
    },
    {
      key: "home.trust",
      title: "اعتماد، قبل از جعبه شروع می‌شود.",
      body: {
        eyebrow: "چرا منبع مهم است؟",
        lead: "برای هر پیشنهاد، منبع خرید و وضعیت بررسی آن کنار محصول قرار می‌گیرد. بررسی منبع به‌معنای ادعای احراز فیزیکی کالا نیست؛ مدرک خرید پس از تهیه ثبت می‌شود.",
        steps: [
          {
            title: "انتخاب منبع",
            body: "پیشنهاد فقط با سابقه و اطلاعات قابل بررسی نمایش داده می‌شود.",
          },
          {
            title: "قیمت تازه",
            body: "پیش از پرداخت، مبلغ با نرخ به‌روز دوباره محاسبه می‌شود.",
          },
          {
            title: "ثبت مسیر خرید",
            body: "از تهیه در آلمان تا رسیدن به ایران، وضعیت سفارش قابل پیگیری است.",
          },
        ],
      },
    },
    {
      key: "home.find_it",
      title: "لینک یا عکسش را برای ما بفرستید.",
      body: {
        eyebrow: "پیدایش نکردید؟",
        lead: "درخواست را بررسی می‌کنیم و اگر امکان تهیه باشد، گزینه و قیمت را شفاف پیشنهاد می‌دهیم.",
        ctaLabel: "برام پیدا کن",
      },
    },
  ] as const;

  for (const entry of entries) {
    await db
      .insert(contentEntries)
      .values({
        key: entry.key,
        locale: "fa-IR",
        version: 1,
        status: "PUBLISHED",
        title: entry.title,
        body: entry.body,
        publishedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [
          contentEntries.key,
          contentEntries.locale,
          contentEntries.version,
        ],
      });
  }
}

/**
 * One demo order at DEPOSIT_PAID with a matching quote.
 *
 * Money is computed with the same helpers the pricing engine will use, so the
 * seeded row satisfies the database check constraints rather than being a
 * hand-tuned magic number.
 */
async function seedDemoOrder(db: Database, fxRateId: string) {
  const orderNumber = "RAVA-DEMO-0001";
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (existing !== undefined) return;

  const [customer] = await db
    .insert(users)
    .values({
      phoneE164: "+989120000000",
      displayName: "مشتری نمونه",
      role: "CUSTOMER",
    })
    // The phone uniqueness index is partial, so the predicate must be repeated.
    .onConflictDoNothing({
      target: users.phoneE164,
      where: sql`${users.phoneE164} is not null`,
    })
    .returning();

  const buyer =
    customer ??
    (
      await db
        .select()
        .from(users)
        .where(eq(users.phoneE164, "+989120000000"))
        .limit(1)
    )[0];
  if (buyer === undefined) throw new Error("Demo customer missing");

  const demo = DEMO_PRODUCTS[2];
  if (demo === undefined) throw new Error("Demo product missing");

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.skuInternal, "RAVA-ADI-SMB-42"))
    .limit(1);
  if (variant === undefined) throw new Error("Demo variant missing");

  const [offer] = await db
    .select()
    .from(sourceOffers)
    .where(eq(sourceOffers.productVariantId, variant.id))
    .limit(1);
  if (offer === undefined) throw new Error("Demo offer missing");

  const sourceEur = offer.sourcePriceEurCents + (offer.shippingEurCents ?? 0n);
  const sourceToman = convertEurCentsToToman(sourceEur, DEMO_FX_TOMAN_PER_EUR);
  const transportToman = 900_000n;
  const customsRiskToman = applyBps(sourceToman, 400);
  const localDeliveryToman = 150_000n;
  const preMargin =
    sourceToman + transportToman + customsRiskToman + localDeliveryToman;
  const marginToman = applyBps(preMargin, 2_550);
  const lineTotal = roundUpToUnit(preMargin + marginToman, 10_000n);
  const deposit = depositAmount({
    total: lineTotal,
    depositBps: 3_500,
    minimumToman: 500_000n,
    roundingUnit: 10_000n,
  });
  const balance = lineTotal - deposit;

  await db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({
        userId: buyer.id,
        fxRateId,
        fxTomanPerEur: DEMO_FX_TOMAN_PER_EUR,
        subtotalToman: lineTotal,
        finalToman: lineTotal,
        depositToman: deposit,
        balanceToman: balance,
        calculationVersion: CALCULATION_VERSION,
        status: "CONSUMED",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
      .returning();
    if (quote === undefined) throw new Error("Demo quote insert failed");

    await tx.insert(quoteItems).values({
      quoteId: quote.id,
      sourceOfferId: offer.id,
      productVariantId: variant.id,
      quantity: 1,
      sourcePriceEurCents: offer.sourcePriceEurCents,
      shippingEurCents: offer.shippingEurCents ?? 0n,
      sourceTomanTotal: sourceToman,
      transportToman,
      customsRiskToman,
      localDeliveryToman,
      marginToman,
      lineTotalToman: lineTotal,
      breakdown: {
        fxTomanPerEur: DEMO_FX_TOMAN_PER_EUR.toString(),
        note: "Demo calculation using the Phase 2 money helpers.",
      },
    });

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: buyer.id,
        quoteId: quote.id,
        status: "DEPOSIT_PAID",
        totalLockedToman: lineTotal,
        depositRequiredToman: deposit,
        depositPaidToman: deposit,
        balanceDueToman: balance,
        placedAt: new Date(),
      })
      .returning();
    if (order === undefined) throw new Error("Demo order insert failed");

    await tx.insert(orderItems).values({
      orderId: order.id,
      productVariantId: variant.id,
      sourceOfferId: offer.id,
      productSnapshot: {
        titleFa: demo.titleFa,
        titleOriginal: demo.titleOriginal,
        brand: "Adidas",
        variant: { size: variant.size ?? "", color: variant.color ?? "" },
      },
      offerSnapshot: {
        retailer: "RAVA Demo Retailer",
        sourceUrl: offer.sourceUrl,
        priceEurCents: offer.sourcePriceEurCents.toString(),
        observedAt: offer.lastSeenAt.toISOString(),
      },
      quantity: 1,
      unitTotalToman: lineTotal,
      lineTotalToman: lineTotal,
      maxSourcePriceEurCents: offer.sourcePriceEurCents,
      procurementStatus: "PENDING",
      sourceStockStatus: "IN_STOCK",
      // Nothing has been physically procured, so authenticity stays at source level.
      authenticityStatus: "SOURCE_VERIFIED",
    });

    for (const step of ["QUOTED", "DEPOSIT_PENDING", "DEPOSIT_PAID"] as const) {
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        toStatus: step,
        note: "Seeded demo history.",
      });
    }
  });
}

async function seedTrip(db: Database) {
  // Relative to run time so the storefront strip always has an open window.
  const day = 24 * 60 * 60 * 1000;
  const departureStart = new Date(Date.now() + 21 * day);

  await db
    .insert(trips)
    .values({
      code: "TRIP-DEMO-01",
      title: "سفر نمونه آلمان به ایران",
      status: "COLLECTING",
      departureWindowStart: departureStart,
      departureWindowEnd: new Date(departureStart.getTime() + 7 * day),
      arrivalWindowStart: new Date(departureStart.getTime() + 10 * day),
      arrivalWindowEnd: new Date(departureStart.getTime() + 20 * day),
      capacityWeightGrams: 25_000,
      notes: "Demo trip for development.",
    })
    .onConflictDoNothing({ target: trips.code });
}

export async function seed(db: Database): Promise<SeedCounts> {
  const [existingRate] = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.provider, "fake"))
    .limit(1);
  const rate = existingRate ?? (await seedFxRate(db));

  const taxonomy = await seedTaxonomy(db);
  await seedCatalog(db, taxonomy);
  const retailerByDomain = await seedRetailers(db);
  await seedOffers(db, retailerByDomain);
  await seedPricingRules(db, taxonomy);
  await seedFeatureFlags(db);
  await seedContent(db);
  await seedTrip(db);
  await seedDemoOrder(db, rate.id);

  const counts = await Promise.all(
    (
      [
        ["brands", brands],
        ["categories", categories],
        ["products", products],
        ["product_variants", productVariants],
        ["source_offers", sourceOffers],
        ["orders", orders],
      ] as const
    ).map(async ([name, table]) => {
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(table);
      return [name, row?.value ?? 0] as const;
    }),
  );

  return Object.fromEntries(counts);
}

// Executed only when run directly (`pnpm db:seed`), not when imported by tests.
if (process.argv[1]?.endsWith("seed.ts") === true) {
  const handle = createDatabase({ maxConnections: 1 });
  try {
    const counts = await seed(handle.db);
    process.stdout.write(`Seed completed: ${JSON.stringify(counts)}\n`);
  } finally {
    await handle.close();
  }
}
