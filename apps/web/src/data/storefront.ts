export type Product = {
  slug: string;
  brand: string;
  name: string;
  variant: string;
  category: string;
  estimatedPriceToman: number;
  sourcePriceEuro: number;
  source: string;
  sourceTier: "verified" | "review";
  delivery: string;
  image: string;
  imageAlt: string;
  accent: "rose" | "sage" | "sand" | "blue";
};

export const products: Product[] = [
  {
    slug: "lumen-eau-de-parfum",
    brand: "LUMEN",
    name: "ادو پرفیوم لومِن",
    variant: "۵۰ میلی‌لیتر · نمونه نمایشی",
    category: "عطر و رایحه",
    estimatedPriceToman: 8_950_000,
    sourcePriceEuro: 74,
    source: "فروشگاه منتخب آلمان",
    sourceTier: "verified",
    delivery: "تحویل تقریبی ۲ تا ۴ ماه",
    image: "/products/perfume.svg",
    imageAlt: "تصویر نمایشی شیشه عطر لومِن",
    accent: "rose",
  },
  {
    slug: "derma-calm-serum",
    brand: "DERMA LAB",
    name: "سرم آبرسان Calm",
    variant: "۳۰ میلی‌لیتر · نمونه نمایشی",
    category: "مراقبت پوست",
    estimatedPriceToman: 4_280_000,
    sourcePriceEuro: 32,
    source: "داروخانه منتخب آلمان",
    sourceTier: "verified",
    delivery: "تحویل تقریبی ۲ تا ۴ ماه",
    image: "/products/serum.svg",
    imageAlt: "تصویر نمایشی بطری سرم آبرسان",
    accent: "sage",
  },
  {
    slug: "nord-runner-02",
    brand: "NORD",
    name: "کتانی Runner 02",
    variant: "سایز ۳۷ تا ۴۱ · نمونه نمایشی",
    category: "کفش و کتانی",
    estimatedPriceToman: 12_600_000,
    sourcePriceEuro: 108,
    source: "فروشگاه منتخب آلمان",
    sourceTier: "review",
    delivery: "تحویل تقریبی ۳ تا ۶ ماه",
    image: "/products/sneaker.svg",
    imageAlt: "تصویر نمایشی کتانی سفید نورد",
    accent: "blue",
  },
  {
    slug: "atelier-mini-bag",
    brand: "ATELIER N",
    name: "کیف دوشی Mini",
    variant: "رنگ زرشکی · نمونه نمایشی",
    category: "کیف و اکسسوری",
    estimatedPriceToman: 10_750_000,
    sourcePriceEuro: 89,
    source: "بوتیک منتخب آلمان",
    sourceTier: "verified",
    delivery: "تحویل تقریبی ۳ تا ۵ ماه",
    image: "/products/bag.svg",
    imageAlt: "تصویر نمایشی کیف دوشی زرشکی",
    accent: "sand",
  },
];

export const categories = [
  { name: "عطر و رایحه", symbol: "ع", href: "/category?type=fragrance" },
  { name: "مراقبت پوست", symbol: "پ", href: "/category?type=skincare" },
  { name: "آرایش", symbol: "آ", href: "/category?type=makeup" },
  { name: "کفش و کتانی", symbol: "ک", href: "/category?type=shoes" },
  { name: "کیف و اکسسوری", symbol: "ا", href: "/category?type=accessories" },
] as const;

export function formatToman(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
