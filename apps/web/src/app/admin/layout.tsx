import type { Metadata } from "next";

import { AdminNavigation } from "../../components/admin";
import { requireAdmin } from "../../server/admin";

export const metadata: Metadata = {
  title: { default: "مدیریت", template: "%s | مدیریت روا" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();
  return (
    <div className="admin-shell">
      <AdminNavigation user={user} />
      <section className="admin-content">{children}</section>
    </div>
  );
}
