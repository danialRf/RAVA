import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "@rava/ui/styles/tokens.css";
import "./styles.css";
import { BottomNav, Footer, Header } from "../components/storefront";
import { siteUrl } from "../lib/site";
import { nextTrip } from "../server/catalog";
import { formatDate } from "../lib/format";

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

/**
 * Announcement copy.
 *
 * Built from the next open trip when one exists; otherwise it stays generic
 * rather than promising a window we do not have.
 */
async function announcement(): Promise<string> {
  const trip = await nextTrip();
  if (trip?.departureWindowStart == null) {
    return "سفارش‌ها برای سفر بعدی جمع‌آوری می‌شود";
  }
  return `پنجره سفارش سفر بعدی تا ${formatDate(trip.departureWindowStart)} باز است`;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa-IR" dir="rtl">
      <body>
        <a className="skip-link" href="#main-content">
          رفتن به محتوای اصلی
        </a>
        <Header announcement={await announcement()} />
        <main id="main-content">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
