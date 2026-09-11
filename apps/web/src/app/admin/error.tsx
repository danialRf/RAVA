"use client";

import { AdminActionButton, AdminErrorState } from "../../components/admin-ui";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorState
      action={
        <AdminActionButton onClick={reset} tone="primary">
          تلاش دوباره
        </AdminActionButton>
      }
    >
      اطلاعات این صفحه بارگذاری نشد. اتصال را بررسی کنید و دوباره تلاش کنید.
    </AdminErrorState>
  );
}
