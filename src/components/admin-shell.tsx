"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { RouteStatus } from "@/components/route-status";
import { Notice } from "@/components/ui";
import { useAdmin } from "@/context/admin";

const links = [
  { href: "/admin", label: "Overview", icon: "home" as const },
  { href: "/admin/schools", label: "Schools", icon: "schools" as const },
  { href: "/admin/broadcast", label: "Broadcast", icon: "broadcast" as const },
  { href: "/admin/tickets", label: "Tickets", icon: "messages" as const },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = useAdmin();
  return (
    <div className="min-h-dvh bg-mint-50 md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-forest-950 text-white md:flex">
        <div className="px-5 py-6">
          <p className="font-display text-xl">SchoolLedger</p>
          <p className="mt-1 text-xs tracking-widest text-gold-100 uppercase">Platform admin</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isActive(pathname, link.href) ? "bg-white/15" : "text-white/70"}`}>
              <Icon name={link.icon} />
              {link.label}
            </Link>
          ))}
          <Link href="/admin/info" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/70">Platform info</Link>
        </nav>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-mint-200 bg-white px-4 py-3">
        <div>
          <p className="font-display text-lg font-semibold">Platform</p>
          <p className="text-sm text-ink-400">{admin.mode === "demo" ? "Demo data on this device" : "Server-side school access"}</p>
        </div>
        <button type="button" className="min-h-12 rounded-xl px-3 font-semibold text-forest-800" onClick={() => void admin.signOut()}>Sign out</button>
      </header>
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8">
        {admin.mode === "demo" ? <p className="rounded-2xl bg-gold-100 px-4 py-3 text-sm">This is demo admin data. It never reads or writes the live database.</p> : null}
        {admin.error && admin.mode !== "denied" && admin.mode !== "unconfigured" ? <Notice type="err" text={admin.error} onDismiss={admin.dismiss} /> : null}
        {admin.notice ? <Notice type="ok" text={admin.notice} onDismiss={admin.dismiss} /> : null}
        {admin.mode === "loading" ? (
          <RouteStatus title="Loading admin" body="Checking the platform account and the school list." />
        ) : admin.mode === "denied" || admin.mode === "unconfigured" ? (
          <RouteStatus
            tone="error"
            title="Admin is unavailable"
            body={admin.error || "Sign in with a platform admin account."}
            action={
              <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 font-semibold text-clay-700">
                Back to sign in
              </a>
            }
          />
        ) : (
          children
        )}
      </div>
      <nav className="fixed inset-x-0 bottom-0 border-t border-mint-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-4">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={`flex min-h-16 flex-col items-center justify-center text-[11px] font-semibold ${isActive(pathname, link.href) ? "text-forest-800" : "text-ink-400"}`}>
                <Icon name={link.icon} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
