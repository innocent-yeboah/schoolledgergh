"use client";

import Link from "next/link";
import { Card, EmptyState, Stat } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { annotatePayments, classRollups } from "@/lib/domain";
import { formatCedis, roundMoney } from "@/lib/format";

export default function DashboardPage() {
  const { students, payments, school } = useLedger();
  const expected = roundMoney(students.reduce((sum, student) => sum + student.termFee, 0));
  const collected = roundMoney(students.reduce((sum, student) => sum + student.paid, 0));
  const outstanding = roundMoney(expected - collected);
  const owing = students.filter((student) => student.status !== "paid").length;
  const rate = school?.feedingFee ?? 0;
  const rollups = classRollups(students);
  const recent = annotatePayments(students, payments).slice(0, 5);
  const percent = expected > 0 ? Math.round((collected / expected) * 100) : 0;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expected" value={formatCedis(expected)} detail={`${students.length} students`} />
        <Stat label="Collected" value={formatCedis(collected)} detail={`${percent}% of fees`} />
        <Stat label="Outstanding" value={formatCedis(outstanding)} detail={`${owing} not fully paid`} tone="red" />
        <Stat label="Feeding today" value={formatCedis(rate * students.length)} detail={`${formatCedis(rate)} each`} tone="gold" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Fees by class">
          {rollups.length ? rollups.map((row) => (
            <div key={row.className} className="mb-3">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{row.className}</span>
                <span className="font-mono text-xs">{formatCedis(row.collected)} · {row.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-mint-100">
                <div className="h-2 rounded-full bg-forest-800" style={{ width: `${Math.min(row.percent, 100)}%` }} />
              </div>
            </div>
          )) : <EmptyState title="No students yet" body="Add a student to see fees by class." />}
        </Card>
        <Card title="Recent payments" action={<Link href="/app/fees" className="text-sm font-semibold text-forest-800">All</Link>}>
          {recent.length ? (
            <ul className="divide-y divide-mint-100">
              {recent.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{payment.studentName}</p>
                    <p className="font-mono text-xs text-ink-400">{payment.txnId}</p>
                  </div>
                  <p className="font-semibold text-forest-800">{formatCedis(payment.amount)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No payments yet" body="Record a fee payment when a parent pays." />}
        </Card>
      </div>
    </div>
  );
}
