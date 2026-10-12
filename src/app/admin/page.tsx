"use client";

import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { useAdmin } from "@/context/admin";
import { formatCedis, formatDate } from "@/lib/format";

export default function AdminOverviewPage() {
  const { schools } = useAdmin();
  const students = schools.reduce((sum, school) => sum + school.studentCount, 0);
  const fees = schools.reduce((sum, school) => sum + school.feesCollected, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Schools" value={String(schools.length)} detail="Registered" />
        <Stat label="Students" value={String(students)} detail="Counted from enrolment" tone="blue" />
        <Stat label="Fees tracked" value={formatCedis(fees)} detail="Sum of payments" tone="gold" />
      </div>
      <Card title="Schools" action={<Link href="/admin/schools" className="text-sm font-semibold text-forest-800">Manage</Link>}>
        <ul className="divide-y divide-mint-100">
          {schools.slice(0, 6).map((school) => (
            <li key={school.id} className="py-3">
              <p className="font-semibold">{school.name}</p>
              <p className="text-sm text-ink-400">{school.email || "No email"} · {school.term} · {formatDate(school.createdAt)}</p>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-2">
        <Link href="/admin/broadcast" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-forest-800 font-semibold text-white">Broadcast</Link>
        <Link href="/admin/schools" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-mint-200 bg-white font-semibold">All schools</Link>
      </div>
    </div>
  );
}
