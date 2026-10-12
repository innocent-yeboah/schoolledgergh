"use client";

import { SchoolShell } from "@/components/school-shell";
import { LedgerProvider } from "@/context/ledger";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LedgerProvider>
      <SchoolShell>{children}</SchoolShell>
    </LedgerProvider>
  );
}
