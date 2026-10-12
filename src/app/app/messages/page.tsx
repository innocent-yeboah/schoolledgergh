"use client";

import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, LogBadge, SelectInput, TextArea, TextInput } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { downloadCsv } from "@/lib/csv";
import { bulkBccMailto, individualMailto } from "@/lib/email/mailto";
import { DEFAULT_TPL_REMINDER, fillTemplate, PAYMENT_LINK_PLACEHOLDER, reminderVars, studentName } from "@/lib/domain";
import { personaliseReminder } from "@/lib/sms/reminders";
import { formatWhen, todayISO } from "@/lib/format";
import { whatsAppLink, whatsAppShareLink } from "@/lib/phone";
import type { StudentView } from "@/lib/types";

type Audience = "all" | "owing" | "paid" | "single";

export default function MessagesPage() {
  const ledger = useLedger();
  const [tab, setTab] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [audience, setAudience] = useState<Audience>("owing");
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<"reminder" | "general" | "custom">("reminder");
  const [custom, setCustom] = useState("");
  const [sms, setSms] = useState("Dear {parent_name}, {student_name} owes GH₵{balance} for {term} ({academic_year}). Pay with mobile money: {payment_link}");
  const [subject, setSubject] = useState(ledger.school ? `School fee reminder — ${ledger.school.term}` : "School notice");
  const [body, setBody] = useState("");
  const recipients = useMemo(() => filterStudents(ledger.students, audience, studentId), [audience, ledger.students, studentId]);
  const sample = recipients[0];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        {(["whatsapp", "sms", "email"] as const).map((item) => (
          <button key={item} type="button" className={`min-h-12 rounded-xl font-semibold capitalize ${tab === item ? "bg-forest-800 text-white" : "bg-white"}`} onClick={() => setTab(item)}>{item === "sms" ? "SMS" : item === "email" ? "Email" : "WhatsApp"}</button>
        ))}
      </div>
      {tab === "whatsapp" ? (
        <Card title="WhatsApp reminders">
          <AudienceFields audience={audience} setAudience={setAudience} studentId={studentId} setStudentId={setStudentId} students={ledger.students} />
          <Field label="Message type">
            <SelectInput value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="reminder">Fee reminder</option>
              <option value="general">General announcement</option>
              <option value="custom">Custom message</option>
            </SelectInput>
          </Field>
          <Field label="Extra note"><TextArea value={custom} onChange={(event) => setCustom(event.target.value)} rows={3} /></Field>
          <pre className="mb-3 rounded-xl bg-[#E5DDD5] p-3 text-sm whitespace-pre-wrap">{sample && ledger.school ? whatsAppText(ledger.school, sample, kind, custom) : "Add a matching student to preview a message."}</pre>
          <div className="grid gap-2">
            {recipients.map((student) => {
              const text = ledger.school ? whatsAppText(ledger.school, student, kind, custom) : "";
              const href = whatsAppLink(student.parentPhone, text);
              if (!href) return <p key={student.id} className="text-sm text-ink-400">{studentName(student)} has no valid WhatsApp number.</p>;
              return (
                <a key={student.id} href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#128C4A] px-4 font-semibold text-white" onClick={() => void ledger.logMessage({ channel: "whatsapp", messageType: kind, recipient: student.parentName, studentLabel: studentName(student), txnId: "", status: "opened" })}>
                  WhatsApp {student.parentName}
                </a>
              );
            })}
            {ledger.school ? (
              <a className="inline-flex min-h-12 items-center justify-center rounded-xl border border-mint-200 font-semibold" href={whatsAppShareLink(custom || `Announcement from ${ledger.school.name}`)} target="_blank" rel="noreferrer">
                Share one announcement
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === "sms" ? <SmsPanel recipients={recipients} audience={audience} setAudience={setAudience} message={sms} setMessage={setSms} /> : null}
      {tab === "email" ? (
        <EmailPanel
          recipients={recipients}
          audience={audience}
          setAudience={setAudience}
          subject={subject}
          setSubject={setSubject}
          body={body}
          setBody={setBody}
        />
      ) : null}
      <Card title="Message log" action={<Button type="button" variant="ghost" onClick={() => downloadCsv(`messages-${todayISO()}.csv`, [["Time", "Channel", "Type", "Recipient", "Student", "Transaction", "Status"], ...ledger.messages.map((item) => [item.createdAt, item.channel, item.messageType, item.recipient, item.studentLabel, item.txnId, item.status])])}>Export</Button>}>
        {ledger.messages.length ? (
          <ul className="divide-y divide-mint-100">
            {ledger.messages.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{item.recipient || item.studentLabel}</p>
                  <p className="text-sm text-ink-400">{item.channel} · {item.messageType} · {formatWhen(item.createdAt)}</p>
                  {item.txnId ? <p className="font-mono text-xs text-ink-400">{item.txnId}</p> : null}
                </div>
                <LogBadge status={item.status} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No messages yet" body="WhatsApp opens are logged as opened. SMS is logged as sent only after the provider accepts it." />}
      </Card>
    </div>
  );
}

function SmsPanel({ recipients, audience, setAudience, message, setMessage }: { recipients: StudentView[]; audience: Audience; setAudience: (value: Audience) => void; message: string; setMessage: (value: string) => void }) {
  const ledger = useLedger();
  const [pending, setPending] = useState(false);
  const owing = audience !== "all";
  const sample = recipients.find((student) => student.balance > 0.001) ?? recipients[0];
  const preview = sample && ledger.school
    ? personaliseReminder(message, { ...reminderVars(ledger.school, sample, PAYMENT_LINK_PLACEHOLDER), payment_link: PAYMENT_LINK_PLACEHOLDER })
    : "Add a student to preview a personal message.";
  return (
    <Card title="SMS">
      <p className="mb-3 rounded-xl bg-gold-100 px-3 py-3 text-sm">Each parent gets their own balance and mobile-money link. The provider key stays on the server. A row is logged as sent only when Arkesel, Hubtel, or mNotify accepts that message.</p>
      <Field label="Send to">
        <SelectInput value={owing ? "owing" : "all"} onChange={(event) => setAudience(event.target.value as Audience)}>
          <option value="owing">All owing parents</option>
          <option value="all">All parents</option>
        </SelectInput>
      </Field>
      <Field label="Message">
        <TextArea maxLength={480} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Use {parent_name}, {student_name}, {balance}, {payment_link}" />
      </Field>
      <pre className="mb-3 rounded-xl bg-mint-50 p-3 text-sm whitespace-pre-wrap">{preview}</pre>
      <p className="mb-3 text-right font-mono text-xs text-ink-400">{message.length}/480 · {recipients.length} parents</p>
      <Button
        type="button"
        variant="sms"
        className="w-full"
        disabled={pending || recipients.length === 0}
        onClick={async () => {
          if (ledger.mode === "demo") {
            ledger.report("Demo mode does not send SMS, so nothing was marked as sent.", "err");
            return;
          }
          setPending(true);
          try {
            const response = await fetch("/api/sms/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audience: owing ? "owing" : "selected",
                studentIds: recipients.map((student) => student.id),
                message,
              }),
            });
            const body = (await response.json()) as { error?: string; sent?: number; failed?: number; errors?: string[]; linkWarnings?: string[] };
            await ledger.refresh();
            if (!response.ok) throw new Error(body.error || body.errors?.[0] || "SMS was not sent.");
            if ((body.sent ?? 0) === 0) throw new Error(body.errors?.[0] || "No SMS was sent.");
            const linkNote = body.linkWarnings?.[0] ? ` ${body.linkWarnings[0]}` : "";
            ledger.report(`Sent ${body.sent}. ${body.failed ? `${body.failed} failed.` : ""}${linkNote}`.trim());
          } catch (error) {
            ledger.report(error instanceof Error ? error.message : "SMS was not sent.", "err");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Sending…" : owing ? "Text all owing parents" : "Send SMS"}
      </Button>
    </Card>
  );
}

function EmailPanel({ recipients, audience, setAudience, subject, setSubject, body, setBody }: { recipients: StudentView[]; audience: Audience; setAudience: (value: Audience) => void; subject: string; setSubject: (value: string) => void; body: string; setBody: (value: string) => void }) {
  const ledger = useLedger();
  const withEmail = recipients.filter((student) => student.parentEmail.trim());
  const personalized = withEmail.map((student) => ({
    student,
    href: ledger.school ? individualMailto({ to: student.parentEmail, subject, body: personalEmail(ledger.school, student, body) }) : "#",
  }));
  const bcc = bulkBccMailto({ bcc: withEmail.map((student) => student.parentEmail), subject, body });

  return (
    <Card title="Email">
      <p className="mb-3 text-sm text-ink-700">Identical announcements use BCC, so parents do not see each other&apos;s addresses. Personal reminders open one email per parent.</p>
      <Field label="Send to">
        <SelectInput value={audience === "single" ? "owing" : audience} onChange={(event) => setAudience(event.target.value as Audience)}>
          <option value="all">All parents with email</option>
          <option value="owing">Parents with a balance</option>
          <option value="paid">Fully paid</option>
        </SelectInput>
      </Field>
      <Field label="Subject"><TextInput value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
      <Field label="Body"><TextArea value={body} onChange={(event) => setBody(event.target.value)} /></Field>
      <p className="mb-3 text-sm text-ink-400">{withEmail.length} parents with an email address.</p>
      <div className="rounded-xl border border-mint-200 p-3 text-sm whitespace-pre-wrap">{body || "Email body"}</div>
      <div className="mt-3 grid gap-2">
        <a
          className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[#6D28D9] px-4 font-semibold text-white ${withEmail.length && body.trim() ? "" : "pointer-events-none opacity-50"}`}
          href={withEmail.length && body.trim() ? bcc : undefined}
          onClick={() => {
            if (!withEmail.length || !body.trim()) return;
            void ledger.logMessage({ channel: "email", messageType: "announcement", recipient: `${withEmail.length} parents via BCC`, studentLabel: "Bulk", txnId: "", status: "opened" });
          }}
        >
          Email identical message with BCC
        </a>
        {personalized.map(({ student, href }) => (
          <a key={student.id} href={href} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-mint-200 font-semibold" onClick={() => void ledger.logMessage({ channel: "email", messageType: "reminder", recipient: student.parentEmail, studentLabel: studentName(student), txnId: "", status: "opened" })}>
            Email {student.parentName} only
          </a>
        ))}
      </div>
    </Card>
  );
}

function AudienceFields({ audience, setAudience, studentId, setStudentId, students }: { audience: Audience; setAudience: (value: Audience) => void; studentId: string; setStudentId: (value: string) => void; students: StudentView[] }) {
  return (
    <>
      <Field label="Send to">
        <SelectInput value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
          <option value="all">All parents</option>
          <option value="owing">Parents with a balance</option>
          <option value="paid">Fully paid</option>
          <option value="single">One parent</option>
        </SelectInput>
      </Field>
      {audience === "single" ? (
        <Field label="Student">
          <SelectInput value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            <option value="">Select</option>
            {students.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}
          </SelectInput>
        </Field>
      ) : null}
    </>
  );
}

function filterStudents(students: StudentView[], audience: Audience, studentId: string): StudentView[] {
  if (audience === "owing") return students.filter((student) => student.status !== "paid");
  if (audience === "paid") return students.filter((student) => student.status === "paid");
  if (audience === "single") return students.filter((student) => student.id === studentId);
  return students;
}

function whatsAppText(school: NonNullable<ReturnType<typeof useLedger>["school"]>, student: StudentView, kind: "reminder" | "general" | "custom", custom: string): string {
  if (kind === "reminder") return fillTemplate(school.tplReminder || DEFAULT_TPL_REMINDER, reminderVars(school, student));
  const note = custom.trim() || `Important notice from ${school.name}`;
  return `Dear ${student.parentName},\n\n${note}\n\n— ${school.name}\n${school.phone}`;
}

function personalEmail(school: NonNullable<ReturnType<typeof useLedger>["school"]>, student: StudentView, body: string): string {
  const reminder = fillTemplate(school.tplReminder || DEFAULT_TPL_REMINDER, reminderVars(school, student));
  return body.trim() ? `${body.trim()}\n\n${reminder}` : reminder;
}
