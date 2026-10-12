"use client";

import { useState } from "react";
import { Card, EmptyState, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { supportEmail } from "@/lib/supabase/env";

export default function TicketsPage() {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [description, setDescription] = useState("");
  const email = supportEmail();
  const href = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`SchoolLedger support [${priority}]: ${title}`)}&body=${encodeURIComponent(description)}` : "";

  return (
    <div className="grid gap-4">
      <Card title="Support ticket">
        <p className="mb-3 text-sm text-ink-700">Tickets open in your mail app. They are not stored in the school database.</p>
        <Field label="Title"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="Priority">
          <SelectInput value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </SelectInput>
        </Field>
        <Field label="Description"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        {email ? (
          <a className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-forest-800 px-4 font-semibold text-white ${title.trim() ? "" : "pointer-events-none opacity-50"}`} href={title.trim() ? href : undefined}>Submit via email</a>
        ) : <p className="text-sm text-clay-700">Set NEXT_PUBLIC_SUPPORT_EMAIL before sending a ticket.</p>}
      </Card>
      <Card title="Open tickets">
        <EmptyState title="No stored tickets" body="Email is the ticket channel in this version." />
      </Card>
    </div>
  );
}
