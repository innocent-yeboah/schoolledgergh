"use client";

import { Card } from "@/components/ui";
import { supportEmail, supportWhatsApp } from "@/lib/supabase/env";

export default function PlatformInfoPage() {
  return (
    <Card title="Platform information">
      <dl className="divide-y divide-mint-100 text-sm">
        <div className="flex justify-between gap-3 py-3"><dt className="text-ink-400">Version</dt><dd className="font-semibold">SchoolLedger GH</dd></div>
        <div className="flex justify-between gap-3 py-3"><dt className="text-ink-400">Market</dt><dd className="font-semibold">Ghana private schools</dd></div>
        <div className="flex justify-between gap-3 py-3"><dt className="text-ink-400">Pilot price</dt><dd className="font-semibold">Free, then GH₵150 per term</dd></div>
        <div className="flex justify-between gap-3 py-3"><dt className="text-ink-400">WhatsApp</dt><dd><a className="font-semibold text-forest-800" href={`https://wa.me/${supportWhatsApp()}`}>+{supportWhatsApp()}</a></dd></div>
        <div className="flex justify-between gap-3 py-3"><dt className="text-ink-400">Email</dt><dd>{supportEmail() || "Set NEXT_PUBLIC_SUPPORT_EMAIL"}</dd></div>
      </dl>
    </Card>
  );
}
