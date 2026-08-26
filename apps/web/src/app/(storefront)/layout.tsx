import { connection } from "next/server";

import { BottomNav, Footer, Header } from "../../components/storefront";
import { formatDate } from "../../lib/format";
import { nextTrip } from "../../server/catalog";

/**
 * Builds factual announcement copy from the next open trip. The query waits
 * for a request so builds do not depend on a live database.
 */
async function announcement(): Promise<string> {
  await connection();
  const trip = await nextTrip();
  if (trip?.departureWindowStart == null) {
    return "سفارش‌ها برای سفر بعدی جمع‌آوری می‌شود";
  }
  return `پنجره سفارش سفر بعدی تا ${formatDate(trip.departureWindowStart)} باز است`;
}

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header announcement={await announcement()} />
      <main id="main-content">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
