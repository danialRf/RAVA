import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "@rava/ui/styles/tokens.css";
import "./styles.css";
import { siteUrl } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "روا | اصل، آن‌طور که باید باشد", template: "%s | روا" },
  description:
    "فروشگاه فارسی برای سفارش شفاف کالا از فروشگاه‌های منتخب آلمان، با قیمت تخمینی روشن و پیگیری مرحله‌به‌مرحله.",
  applicationName: "RAVA",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "روا",
    title: "روا | اصل، آن‌طور که باید باشد",
    description: "سفارش شفاف کالا از آلمان با منبع روشن و قیمت تخمینی.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fffdfc",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa-IR" dir="rtl">
      <body>
        <a className="skip-link" href="#main-content">
          رفتن به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  );
}
