import type { Metadata } from "next";

import { AdminNavigation, AdminTopbar } from "../../components/admin";
import { requireAdmin } from "../../server/admin";
import { adminLogoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "مدیریت", template: "%s | مدیریت روا" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();
  const displayName = user.displayName ?? user.email ?? "همکار روا";
  return (
    <div className="admin-app" dir="rtl">
      <AdminNavigation user={user} />
      <div className="admin-workspace">
        <AdminTopbar
          displayName={displayName}
          logoutAction={adminLogoutAction}
        />
        <main id="main-content" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
