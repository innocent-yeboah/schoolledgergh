"use client";

import { Button, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { studentName } from "@/lib/domain";
import { formatCedis, formatDate, todayISO } from "@/lib/format";

export default function FeedingPage() {
  const ledger = useLedger();
  const today = todayISO();
  const rate = ledger.school?.feedingFee ?? 0;
  const paidIds = new Set(ledger.feeding.filter((mark) => mark.feedDate === today).map((mark) => mark.studentId));
  const paidToday = ledger.students.filter((student) => paidIds.has(student.id)).length;
  const unpaid = ledger.students.length - paidToday;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            void ledger.markAllFeeding(today);
          }}
        >
          Mark all paid today
        </Button>
        <p className="text-sm text-ink-400">Today: {formatDate(today)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Daily rate" value={formatCedis(rate)} detail="Per student" />
        <Stat label="Paid today" value={`${paidToday}/${ledger.students.length}`} detail={formatCedis(paidToday * rate)} />
        <Stat label="Unpaid today" value={String(unpaid)} detail={formatCedis(unpaid * rate)} tone="red" />
        <Stat label="Days logged" value={String(ledger.feeding.length)} detail="All saved marks" tone="blue" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-mint-200 bg-white">
        {ledger.students.length ? ledger.students.map((student) => {
          const days = ledger.feeding.filter((mark) => mark.studentId === student.id).length;
          const paid = paidIds.has(student.id);
          return (
            <article key={student.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-mint-100 p-4 last:border-b-0">
              <div>
                <p className="font-semibold">{studentName(student)}</p>
                <p className="text-sm text-ink-400">{student.className} · {days} days · {formatCedis(days * rate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={paid ? "paid" : "owing"} />
                {paid ? <span className="text-sm text-ink-400">Done</span> : (
                  <Button type="button" onClick={() => void ledger.markFeeding(student.id, today)}>Mark paid</Button>
                )}
              </div>
            </article>
          );
        }) : <EmptyState title="No students enrolled" body="Add students before tracking feeding." />}
      </div>
    </div>
  );
}
