"use client";

import { useState } from "react";
import { Card, Field, TextArea, TextInput } from "@/components/ui";
import { useAdmin } from "@/context/admin";
import { bulkBccMailto } from "@/lib/email/mailto";
import { whatsAppShareLink } from "@/lib/phone";
import { supportWhatsApp } from "@/lib/supabase/env";

export default function BroadcastPage() {
  const { schools } = useAdmin();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const message = `${subject ? `${subject}\n\n` : ""}${body}\n\n— SchoolLedger GH\n+${supportWhatsApp()}`;
  const emails = schools.map((school) => school.email).filter(Boolean);
  const mailto = bulkBccMailto({ bcc: emails, subject: subject || "SchoolLedger update", body });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Broadcast">
        <Field label="Subject"><TextInput value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field label="Message"><TextArea value={body} onChange={(event) => setBody(event.target.value)} /></Field>
        <div className="grid gap-2">
          <a className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[#128C4A] font-semibold text-white ${body.trim() ? "" : "pointer-events-none opacity-50"}`} href={body.trim() ? whatsAppShareLink(message) : undefined}>Open WhatsApp</a>
          <a className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[#6D28D9] font-semibold text-white ${body.trim() && emails.length ? "" : "pointer-events-none opacity-50"}`} href={body.trim() && emails.length ? mailto : undefined}>Email admins with BCC</a>
        </div>
        <p className="mt-3 text-sm text-ink-400">{emails.length} admin emails. BCC keeps those addresses off the To line.</p>
      </Card>
      <Card title="Preview">
        <pre className="text-sm whitespace-pre-wrap">{body.trim() ? `Dear school admin,\n\n${message}` : "Type a message to preview it."}</pre>
      </Card>
    </div>
  );
}
