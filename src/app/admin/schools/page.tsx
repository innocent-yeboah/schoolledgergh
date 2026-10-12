"use client";

import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Modal, TextInput } from "@/components/ui";
import { useAdmin } from "@/context/admin";
import { suggestedAcademicPeriod } from "@/lib/academic";
import { downloadCsv } from "@/lib/csv";
import { formatCedis, formatDate, todayISO } from "@/lib/format";
import { whatsAppLink } from "@/lib/phone";
import type { AdminSchool } from "@/lib/types";

export default function AdminSchoolsPage() {
  const admin = useAdmin();
  const suggested = suggestedAcademicPeriod(new Date());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminSchool | null>(null);
  const [form, setForm] = useState({
    name: "",
    adminName: "",
    phone: "",
    email: "",
    password: "",
    address: "",
    term: suggested.term,
    academicYear: suggested.academicYear,
  });
  const rows = useMemo(
    () => admin.schools.filter((school) => school.name.toLowerCase().includes(query.trim().toLowerCase())),
    [admin.schools, query],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <TextInput className="max-w-sm" placeholder="Search school name" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search schools" />
        <Button type="button" variant="ghost" onClick={() => downloadCsv(`schools-${todayISO()}.csv`, [["Name", "Email", "Phone", "Term", "Year", "Students", "Fees"], ...admin.schools.map((school) => [school.name, school.email, school.phone, school.term, school.academicYear, school.studentCount, school.feesCollected])])}>Export CSV</Button>
      </div>
      <div className="grid gap-3">
        {rows.length ? rows.map((school) => (
          <article key={school.id} className="rounded-2xl border border-mint-200 bg-white p-4">
            <p className="text-lg font-semibold">{school.name}</p>
            <p className="text-sm text-ink-400">{school.email || "No email"} · {school.term} {school.academicYear}</p>
            <p className="mt-1 text-sm">{school.studentCount} students · {formatCedis(school.feesCollected)} collected</p>
            <Button type="button" variant="ghost" className="mt-3" onClick={() => setSelected(school)}>View</Button>
          </article>
        )) : <EmptyState title="No schools" body="Add a school to give it a login." />}
      </div>
      <Card title="Add school">
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await admin.createSchool(form);
            setForm({ ...form, name: "", adminName: "", phone: "", email: "", password: "", address: "" });
          }}
        >
          <Field label="School name"><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Admin name"><TextInput value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
          <Field label="Temporary password"><TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></Field>
          <Field label="Term">
            <select className="min-h-12 w-full rounded-xl border border-mint-200 px-3" value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
              <option>Term 1</option>
              <option>Term 2</option>
              <option>Term 3</option>
            </select>
          </Field>
          <Field label="Academic year"><TextInput value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required /></Field>
          <Field label="Address"><TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          <Button type="submit">Create school account</Button>
        </form>
      </Card>
      {selected ? (
        <Modal title={selected.name} subtitle={`${selected.term} · ${selected.academicYear}`} onClose={() => setSelected(null)}>
          <dl className="space-y-2 text-sm">
            <p><strong>Admin:</strong> {selected.adminName || "—"}</p>
            <p><strong>Email:</strong> {selected.email || "—"}</p>
            <p><strong>Phone:</strong> {selected.phone || "—"}</p>
            <p><strong>Address:</strong> {selected.address || "—"}</p>
            <p><strong>Students:</strong> {selected.studentCount}</p>
            <p><strong>Fees:</strong> {formatCedis(selected.feesCollected)}</p>
            <p><strong>Created:</strong> {formatDate(selected.createdAt)}</p>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsAppLink(selected.phone, `Hello ${selected.adminName || "there"}, this is SchoolLedger GH.`) ? (
              <a className="inline-flex min-h-12 items-center rounded-xl bg-[#128C4A] px-4 font-semibold text-white" href={whatsAppLink(selected.phone, `Hello ${selected.adminName || "there"}, this is SchoolLedger GH.`)!} target="_blank" rel="noreferrer">WhatsApp admin</a>
            ) : null}
            <Button type="button" variant="danger" onClick={async () => {
              if (!window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
              await admin.deleteSchool(selected.id);
              setSelected(null);
            }}>Delete school</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
