"use client";

import { AdminShell } from "@/components/admin-shell";
import { AdminProvider } from "@/context/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
