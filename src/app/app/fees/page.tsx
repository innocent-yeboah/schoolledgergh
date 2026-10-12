"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, EmptyState, Field, Modal, SelectInput, TextInput } from "@/components/ui";
import { useLedger } from "@/context/ledger";
import { downloadCsv } from "@/lib/csv";
import { DEFAULT_TPL_PAYMENT, PAYMENT_METHODS, annotatePayments, fillTemplate, paymentTemplateVars, studentName } from "@/lib/domain";
import { createTxnId, formatCedis, formatDate, todayISO } from "@/lib/format";
import { whatsAppLink } from "@/lib/phone";

export default function FeesRoute() {
  return (
    <Suspense fallback={<p>Loading fees…</p>}>
      <FeesPage />
    </Suspense>
  );
}

function FeesPage() {
  const ledger = useLedger();
  const params = useSearchParams();
  const preset = params.get("student") ?? "";
  const [studentId, setStudentId] = useState(preset);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [paidOn, setPaidOn] = useState(todayISO());
  const [txnId, setTxnId] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<{ amount: number; txnId: string; method: string; paidOn: string; studentId: string; balanceAfter: number } | null>(null);
  const student = ledger.students.find((item) => item.id === studentId) ?? null;
  const parsedAmount = Number(amount);
  const previewTxn = txnId.trim() || "Generated on save";
  const balanceAfter = student && Number.isFinite(parsedAmount) ? student.balance - parsedAmount : null;
  const history = useMemo(() => annotatePayments(ledger.students, ledger.payments), [ledger.payments, ledger.students]);

  return (
    <div className="grid gap-4">
      <Card title="Record fee payment">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const payment = await ledger.recordPayment({
                studentId,
                amount: parsedAmount,
                method,
                paidOn,
                txnId: txnId.trim(),
                notes,
              });
              const view = ledger.students.find((item) => item.id === studentId);
              setReceipt({
                amount: payment.amount,
                txnId: payment.txnId,
                method: payment.method,
                paidOn: payment.paidOn,
                studentId,
                balanceAfter: view ? view.balance - payment.amount : 0,
              });
              setAmount("");
              setTxnId("");
              setNotes("");
            } catch {
              // The save error stays on screen.
            }
          }}
        >
          <Field label="Student">
            <SelectInput value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
              <option value="">Select a student</option>
              {ledger.students.map((item) => (
                <option key={item.id} value={item.id} disabled={item.balance <= 0}>
                  {studentName(item)} ({item.className}) {item.balance <= 0 ? "Paid" : `owes ${formatCedis(item.balance)}`}
                </option>
              ))}
            </SelectInput>
          </Field>
          {student ? (
            <div className="mb-3 rounded-xl bg-mint-50 p-3 text-sm">
              <p className="flex justify-between"><span>Term fee</span><strong>{formatCedis(student.termFee)}</strong></p>
              <p className="flex justify-between"><span>Paid from the ledger</span><strong>{formatCedis(student.paid)}</strong></p>
              <p className="flex justify-between border-t border-mint-200 pt-2"><span>Balance</span><strong>{formatCedis(student.balance)}</strong></p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount (GH₵)"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field>
            <Field label="Method">
              <SelectInput value={method} onChange={(event) => setMethod(event.target.value)}>
                {PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Field label="Date"><TextInput type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required /></Field>
          <Field label="Transaction ID"><TextInput value={txnId} onChange={(event) => setTxnId(event.target.value)} placeholder="Leave blank to generate one" /></Field>
          <Field label="Note"><TextInput value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note" /></Field>
          <Button type="submit" className="w-full">Record payment</Button>
        </form>
      </Card>
      <Card title="Receipt preview">
        {student && parsedAmount > 0 && ledger.school && balanceAfter != null ? (
          <div className="rounded-xl border border-dashed border-mint-200 p-4 text-center">
            <p className="font-mono text-xs tracking-wide text-ink-400 uppercase">{ledger.school.name}</p>
            <p className="font-display text-4xl font-semibold text-forest-800">{formatCedis(parsedAmount)}</p>
            <p className="mt-2 text-sm">{studentName(student)} · {student.className}</p>
            <p className="font-mono text-xs text-ink-400">{previewTxn}</p>
            <p className="mt-2 text-sm">{balanceAfter <= 0 ? "Fully paid" : `Balance after: ${formatCedis(balanceAfter)}`}</p>
            <pre className="mt-4 rounded-xl bg-[#E5DDD5] p-3 text-left text-sm whitespace-pre-wrap">{messageFor(ledger.school, student, parsedAmount, method, paidOn, txnId.trim() || createTxnId(), balanceAfter)}</pre>
          </div>
        ) : <EmptyState title="Nothing to preview" body="Choose a student and enter an amount." />}
      </Card>
      <Card title="Payment history" action={<Button type="button" variant="ghost" onClick={() => downloadCsv(`payments-${todayISO()}.csv`, [["Student", "ID", "Class", "Amount", "Method", "Transaction", "Date", "Balance after", "Note"], ...history.map((payment) => [payment.studentName, payment.studentId, payment.className, payment.amount, payment.method, payment.txnId, payment.paidOn, payment.balanceAfter, payment.notes])])}>Export CSV</Button>}>
        {history.length ? (
          <ul className="divide-y divide-mint-100">
            {history.map((payment) => (
              <li key={payment.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{payment.studentName}</p>
                    <p className="text-sm text-ink-400">{payment.className} · {payment.method} · {formatDate(payment.paidOn)}</p>
                    <p className="font-mono text-xs text-ink-400">{payment.txnId}</p>
                    {payment.notes ? <p className="text-sm">{payment.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-forest-800">{formatCedis(payment.amount)}</p>
                    <p className="text-xs text-ink-400">{payment.balanceAfter == null ? "—" : formatCedis(payment.balanceAfter)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No payments yet" body="Recorded payments will appear here." />}
      </Card>
      {receipt && student ? <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

function messageFor(school: NonNullable<ReturnType<typeof useLedger>["school"]>, student: NonNullable<ReturnType<typeof useLedger>["students"][number]>, amount: number, method: string, paidOn: string, txnId: string, balanceAfter: number) {
  return fillTemplate(school.tplPayment || DEFAULT_TPL_PAYMENT, paymentTemplateVars({
    school,
    student,
    amount,
    method,
    paidOnLabel: formatDate(paidOn),
    txnId,
    balanceAfter,
  }));
}

function ReceiptModal({ receipt, onClose }: { receipt: { amount: number; txnId: string; method: string; paidOn: string; studentId: string; balanceAfter: number }; onClose: () => void }) {
  const ledger = useLedger();
  const student = ledger.students.find((item) => item.id === receipt.studentId);
  if (!ledger.school || !student) return null;
  const fresh = ledger.students.find((item) => item.id === student.id) ?? student;
  const text = messageFor(ledger.school, fresh, receipt.amount, receipt.method, receipt.paidOn, receipt.txnId, fresh.balance);
  const href = whatsAppLink(fresh.parentPhone, text);
  return (
    <Modal title="Payment recorded" subtitle="The balance comes from the payment ledger." onClose={onClose}>
      <div className="rounded-xl border border-dashed border-mint-200 p-4 text-center">
        <p className="font-mono text-xs uppercase">{ledger.school.name}</p>
        <p className="font-display text-4xl text-forest-800">{formatCedis(receipt.amount)}</p>
        <p className="mt-2 text-sm">{studentName(fresh)} · {receipt.method} · {formatDate(receipt.paidOn)}</p>
        <p className="font-mono text-xs">{receipt.txnId}</p>
        <p className="mt-2 text-sm">Balance now {formatCedis(fresh.balance)}</p>
      </div>
      <pre className="mt-3 rounded-xl bg-[#E5DDD5] p-3 text-sm whitespace-pre-wrap">{text}</pre>
      <div className="mt-4 grid gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#128C4A] font-semibold text-white"
            onClick={() => {
              void ledger.logMessage({
                channel: "whatsapp",
                messageType: "receipt",
                recipient: fresh.parentName,
                studentLabel: studentName(fresh),
                txnId: receipt.txnId,
                status: "opened",
              });
            }}
          >
            Open WhatsApp
          </a>
        ) : <p className="text-sm text-clay-700">This parent has no valid Ghana WhatsApp number, so no message was opened.</p>}
        <Button type="button" variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
