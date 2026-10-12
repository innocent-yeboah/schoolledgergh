"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Notice } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { periodLabel, suggestedAcademicPeriod } from "@/lib/academic";
import { DEFAULT_FEEDING_FEE } from "@/lib/domain";
import type { NewSchoolInput } from "@/lib/types";

const links = [
  { href: "/app", label: "Home", icon: "home" as const },
  { href: "/app/students", label: "Students", icon: "students" as const },
  { href: "/app/fees", label: "Fees", icon: "fees" as const },
  { href: "/app/feeding", label: "Feeding", icon: "feeding" as const },
  { href: "/app/messages", label: "Messages", icon: "messages" as const },
];

export function SchoolShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ledger = useLedger();
  const period = ledger.school ? periodLabel(ledger.school.term, ledger.school.academicYear) : "Set term in Settings";

  return (
    <div className="min-h-dvh bg-mint-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-forest-900 text-white md:flex">
        <div className="border-b border-white/10 px-5 py-6">
          <p className="font-display text-xl font-semibold">SchoolLedger</p>
          <p className="mt-1 text-sm text-white/70">{ledger.school?.name || "Your school"}</p>
          <p className="mt-2 font-mono text-xs text-white/60">{period}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((link) => (
            <NavLink key={link.href} {...link} active={isActive(pathname, link.href)} />
          ))}
          <NavLink href="/app/settings" label="Settings" icon="settings" active={pathname === "/app/settings"} />
        </nav>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-mint-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{ledger.school?.name || "SchoolLedger GH"}</p>
            <p className="truncate text-sm text-ink-400">{period}</p>
          </div>
          <div className="flex items-center gap-2">
            {ledger.mode === "demo" ? <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-600">Demo</span> : null}
            <Link href="/app/settings" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-mint-100 text-forest-900" aria-label="Settings">
              <Icon name="settings" />
            </Link>
          </div>
        </header>
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {ledger.mode === "demo" ? (
            <p className="rounded-2xl bg-gold-100 px-4 py-3 text-sm text-ink-700">Demo mode keeps this sample school on this device. It does not write to a database.</p>
          ) : null}
          {ledger.usingCache ? (
            <p className="rounded-2xl bg-gold-100 px-4 py-3 text-sm text-ink-700">Offline copy. New payments and edits are refused until the connection returns.</p>
          ) : null}
          {ledger.notice ? <Notice type={ledger.notice.type} text={ledger.notice.text} onDismiss={ledger.dismissNotice} /> : null}
          {ledger.school ? children : <SetupSchool />}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-mint-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link href={link.href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-forest-800" : "text-ink-400"}`}>
                  <Icon name={link.icon} />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: "home" | "students" | "fees" | "feeding" | "messages" | "settings"; active: boolean }) {
  return (
    <Link href={href} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-white/15" : "text-white/75"}`}>
      <Icon name={icon} />
      {label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function SetupSchool() {
  const ledger = useLedger();
  const suggested = suggestedAcademicPeriod(new Date());
  const [form, setForm] = useState<NewSchoolInput>({
    name: "",
    adminName: "",
    phone: "",
    email: "",
    address: "",
    motto: "",
    term: suggested.term,
    academicYear: suggested.academicYear,
    feedingFee: DEFAULT_FEEDING_FEE,
  });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          await ledger.createSchool(form);
        } catch {
          // The banner already shows the save error.
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="font-display text-3xl font-semibold">Set up your school</h1>
      <p className="mt-2 text-sm text-ink-400">The term and academic year start from today&apos;s Ghana calendar. Change them if your school is on a different period.</p>
      <div className="mt-4 grid gap-3">
        <input className="min-h-12 rounded-xl border border-mint-200 px-3" placeholder="School name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input className="min-h-12 rounded-xl border border-mint-200 px-3" placeholder="Your name" value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} />
        <input className="min-h-12 rounded-xl border border-mint-200 px-3" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <label className="text-sm font-semibold text-ink-700">
          Term
          <select className="mt-1 min-h-12 w-full rounded-xl border border-mint-200 px-3" value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
            <option>Term 1</option>
            <option>Term 2</option>
            <option>Term 3</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-ink-700">
          Academic year
          <input className="mt-1 min-h-12 w-full rounded-xl border border-mint-200 px-3" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required />
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save school"}</Button>
      </div>
    </form>
  );
}
