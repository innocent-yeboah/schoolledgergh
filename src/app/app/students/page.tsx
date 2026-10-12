"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, EmptyState, Field, Modal, SelectInput, StatusBadge, TextInput } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { CLASSES, DEFAULT_TPL_REMINDER, feeForClass, fillTemplate, reminderVars, studentName } from "@/lib/domain";
import { formatCedis } from "@/lib/format";
import { whatsAppLink } from "@/lib/phone";
import type { FeeStatus, StudentView } from "@/lib/types";

const filters: Array<{ id: "all" | FeeStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "partial", label: "Partial" },
  { id: "owing", label: "Owing" },
];

export default function StudentsPage() {
  const ledger = useLedger();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StudentView | null>(null);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ledger.students.filter((student) => {
      const haystack = `${student.firstName} ${student.lastName} ${student.id}`.toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesFilter = filter === "all" || student.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, ledger.students, query]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setOpen(true)}>Add student</Button>
      </div>
      <TextInput placeholder="Search name or ID" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search students" />
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((item) => (
          <button key={item.id} type="button" className={`min-h-12 rounded-xl px-4 font-semibold ${filter === item.id ? "bg-forest-800 text-white" : "bg-white text-ink-700"}`} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-mint-200 bg-white">
        {rows.length ? rows.map((student) => (
          <article key={student.id} className="border-b border-mint-100 p-4 last:border-b-0">
            <button type="button" className="w-full text-left" onClick={() => setSelected(student)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{studentName(student)}</p>
                  <p className="font-mono text-xs text-ink-400">{student.id} · {student.className}</p>
                </div>
                <StatusBadge status={student.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-ink-400">Fee</dt><dd className="font-semibold">{formatCedis(student.termFee)}</dd></div>
                <div><dt className="text-ink-400">Paid</dt><dd className="font-semibold text-forest-800">{formatCedis(student.paid)}</dd></div>
                <div><dt className="text-ink-400">Balance</dt><dd className="font-semibold">{formatCedis(student.balance)}</dd></div>
              </dl>
            </button>
            <div className="mt-3 flex gap-2">
              {student.balance > 0 ? <Link href={`/app/fees?student=${student.id}`} className="inline-flex min-h-12 items-center rounded-xl bg-forest-800 px-4 font-semibold text-white">Record payment</Link> : null}
              <WhatsAppButton student={student} />
            </div>
          </article>
        )) : <EmptyState title={ledger.students.length ? "No matching students" : "No students yet"} body={ledger.students.length ? "Try another filter." : "Add the first student to start tracking fees."} />}
      </div>
      {open ? <AddStudent onClose={() => setOpen(false)} /> : null}
      {selected ? <StudentDetail student={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function WhatsAppButton({ student }: { student: StudentView }) {
  const ledger = useLedger();
  if (!ledger.school) return null;
  const message = fillTemplate(ledger.school.tplReminder || DEFAULT_TPL_REMINDER, reminderVars(ledger.school, student));
  const href = whatsAppLink(student.parentPhone, message);
  if (!href) return <span className="self-center text-sm text-ink-400">No valid WhatsApp number</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-12 items-center rounded-xl bg-[#128C4A] px-4 font-semibold text-white"
      onClick={() => {
        void ledger.logMessage({
          channel: "whatsapp",
          messageType: "reminder",
          recipient: student.parentName,
          studentLabel: studentName(student),
          txnId: "",
          status: "opened",
        });
      }}
    >
      WhatsApp
    </a>
  );
}

type AddStudentForm = {
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  termFee: string;
};

function AddStudent({ onClose }: { onClose: () => void }) {
  const ledger = useLedger();
  const [form, setForm] = useState<AddStudentForm>({
    firstName: "",
    lastName: "",
    className: CLASSES[0],
    gender: "Female",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    termFee: "",
  });
  const preview = ledger.school ? feeForClass(ledger.school, form.className, form.termFee ? Number(form.termFee) : null) : 0;

  return (
    <Modal title="Add student" subtitle="Only your school can see this record." onClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await ledger.addStudent({
              ...form,
              termFee: form.termFee.trim() ? Number(form.termFee) : null,
            });
            onClose();
          } catch {
            // Banner shows the error.
          }
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name"><TextInput value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></Field>
          <Field label="Last name"><TextInput value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Class">
            <SelectInput value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })}>
              {CLASSES.map((name) => <option key={name}>{name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Gender">
            <SelectInput value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
              <option>Female</option>
              <option>Male</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Parent or guardian"><TextInput value={form.parentName} onChange={(event) => setForm({ ...form, parentName: event.target.value })} required /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Parent phone"><TextInput value={form.parentPhone} onChange={(event) => setForm({ ...form, parentPhone: event.target.value })} required /></Field>
          <Field label="Parent email"><TextInput type="email" value={form.parentEmail} onChange={(event) => setForm({ ...form, parentEmail: event.target.value })} /></Field>
        </div>
        <Field label={`Term fee override (class default ${formatCedis(preview)})`}>
          <TextInput inputMode="decimal" value={form.termFee} onChange={(event) => setForm({ ...form, termFee: event.target.value })} placeholder="Leave blank for the class fee" />
        </Field>
        <Button type="submit" className="w-full">Add student</Button>
      </form>
    </Modal>
  );
}

function StudentDetail({ student, onClose }: { student: StudentView; onClose: () => void }) {
  const ledger = useLedger();
  return (
    <Modal title={studentName(student)} subtitle={`${student.id} · ${student.className} · ${student.gender}`} onClose={onClose}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-mint-50 p-3"><dt className="text-ink-400">Term fee</dt><dd className="font-display text-2xl">{formatCedis(student.termFee)}</dd></div>
        <div className="rounded-xl bg-mint-50 p-3"><dt className="text-ink-400">Balance from payments</dt><dd className="font-display text-2xl">{formatCedis(student.balance)}</dd></div>
      </dl>
      <div className="mt-4 space-y-1 text-sm">
        <p><strong>Parent:</strong> {student.parentName}</p>
        <p><strong>Phone:</strong> {student.parentPhone}</p>
        {student.parentEmail ? <p><strong>Email:</strong> {student.parentEmail}</p> : null}
        <p><strong>Last payment:</strong> {student.lastPaymentOn || "—"} {student.lastMethod ? `· ${student.lastMethod}` : ""}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="danger" onClick={async () => {
          if (!window.confirm(`Remove ${studentName(student)}? Payment history stays.`)) return;
          try {
            await ledger.removeStudent(student.id);
            onClose();
          } catch {
            // Banner shows the error.
          }
        }}>Remove</Button>
        <Link href={`/app/fees?student=${student.id}`} className="inline-flex min-h-12 items-center rounded-xl bg-forest-800 px-4 font-semibold text-white" onClick={onClose}>Record payment</Link>
      </div>
    </Modal>
  );
}
