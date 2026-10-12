"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { CLASSES, DEFAULT_CLASS_FEES, TEMPLATE_VARIABLES } from "@/lib/domain";
import { supportEmail, supportWhatsApp } from "@/lib/supabase/env";

export default function SettingsPage() {
  const ledger = useLedger();
  const school = ledger.school;
  const [sms, setSms] = useState<{ configured: boolean; provider: string | null; senderId: string } | null>(null);

  useEffect(() => {
    if (ledger.mode !== "live") return;
    fetch("/api/sms/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body) setSms(body as { configured: boolean; provider: string | null; senderId: string });
      })
      .catch(() => setSms(null));
  }, [ledger.mode]);

  if (!school) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Academic period">
        <p className="mb-3 text-sm text-ink-700">Reminders, the dashboard, and receipts use the period saved here.</p>
        <PeriodForm />
      </Card>
      <Card title="School information">
        <SchoolForm />
      </Card>
      <Card title="Class fees (GH₵ per term)">
        <ClassFees />
      </Card>
      <Card title="Message templates">
        <p className="mb-3 text-xs text-ink-400">{TEMPLATE_VARIABLES.join(" ")}</p>
        <TemplateForm />
      </Card>
      <Card title="SMS">
        {ledger.mode === "demo" ? (
          <p className="text-sm">Demo mode does not send SMS and does not store a provider key.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>The Hubtel or Arkesel key stays in the server environment. It is not saved on the school and it is not sent to the browser.</p>
            <p>{sms?.configured ? `Ready to send as ${sms.senderId} via ${sms.provider}.` : "SMS is not live yet. Set SMS_PROVIDER, SMS_API_KEY, and SMS_LIVE=true on the server."}</p>
          </div>
        )}
      </Card>
      <Card title="Support">
        <div className="grid gap-2 text-sm">
          <a className="font-semibold text-forest-800" href={`https://wa.me/${supportWhatsApp()}`}>WhatsApp {supportWhatsApp()}</a>
          <a className="font-semibold text-forest-800" href={`tel:+${supportWhatsApp()}`}>Call +{supportWhatsApp()}</a>
          {supportEmail() ? <a className="font-semibold text-forest-800" href={`mailto:${supportEmail()}`}>{supportEmail()}</a> : <p className="text-ink-400">Set NEXT_PUBLIC_SUPPORT_EMAIL to show a support address.</p>}
        </div>
        <div className="mt-4 grid gap-2">
          {ledger.mode === "demo" ? <Button type="button" variant="ghost" onClick={ledger.resetDemo}>Reset demo data</Button> : null}
          <Button type="button" variant="danger" onClick={() => void ledger.signOut()}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}

function PeriodForm() {
  const ledger = useLedger();
  const school = ledger.school!;
  const [term, setTerm] = useState(school.term);
  const [academicYear, setAcademicYear] = useState(school.academicYear);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await ledger.saveSchool({ term, academicYear });
        } catch {
          // Banner shows the error.
        }
      }}
    >
      <Field label="Term">
        <SelectInput value={term} onChange={(event) => setTerm(event.target.value)}>
          {["Term 1", "Term 2", "Term 3", term].filter((value, index, all) => all.indexOf(value) === index).map((value) => <option key={value}>{value}</option>)}
        </SelectInput>
      </Field>
      <Field label="Academic year"><TextInput value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} required /></Field>
      <Button type="submit">Save period</Button>
    </form>
  );
}

function SchoolForm() {
  const ledger = useLedger();
  const school = ledger.school!;
  const [form, setForm] = useState({
    name: school.name,
    address: school.address,
    phone: school.phone,
    email: school.email,
    motto: school.motto,
    feedingFee: String(school.feedingFee),
  });
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await ledger.saveSchool({ ...form, feedingFee: Number(form.feedingFee) || 0 });
        } catch {
          // Banner shows the error.
        }
      }}
    >
      <Field label="School name"><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
      <Field label="Address"><TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
      <Field label="Phone"><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
      <Field label="Email"><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
      <Field label="Motto"><TextInput value={form.motto} onChange={(event) => setForm({ ...form, motto: event.target.value })} /></Field>
      <Field label="Daily feeding fee (GH₵)"><TextInput inputMode="decimal" value={form.feedingFee} onChange={(event) => setForm({ ...form, feedingFee: event.target.value })} /></Field>
      <Button type="submit">Save school info</Button>
    </form>
  );
}

function ClassFees() {
  const ledger = useLedger();
  const school = ledger.school!;
  const [fees, setFees] = useState<Record<string, string>>(() => Object.fromEntries(CLASSES.map((name) => [name, String(school.classFees[name] ?? DEFAULT_CLASS_FEES[name] ?? "")])));
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const classFees = Object.fromEntries(CLASSES.map((name) => [name, Number(fees[name]) || 0]));
        try {
          await ledger.saveSchool({ classFees });
        } catch {
          // Banner shows the error.
        }
      }}
    >
      <div className="grid gap-2">
        {CLASSES.map((name) => (
          <label key={name} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm font-semibold">
            {name}
            <TextInput inputMode="decimal" aria-label={`${name} fee`} value={fees[name] ?? ""} onChange={(event) => setFees({ ...fees, [name]: event.target.value })} />
          </label>
        ))}
      </div>
      <Button type="submit" className="mt-3">Save class fees</Button>
    </form>
  );
}

function TemplateForm() {
  const ledger = useLedger();
  const school = ledger.school!;
  const [tplPayment, setTplPayment] = useState(school.tplPayment);
  const [tplReminder, setTplReminder] = useState(school.tplReminder);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await ledger.saveSchool({ tplPayment, tplReminder });
        } catch {
          // Banner shows the error.
        }
      }}
    >
      <Field label="Payment confirmed"><TextArea rows={8} value={tplPayment} onChange={(event) => setTplPayment(event.target.value)} /></Field>
      <Field label="Fee reminder"><TextArea rows={6} value={tplReminder} onChange={(event) => setTplReminder(event.target.value)} /></Field>
      <Button type="submit">Save templates</Button>
    </form>
  );
}
