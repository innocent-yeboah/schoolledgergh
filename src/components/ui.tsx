import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { FeeStatus, MessageStatus } from "@/lib/types";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "whatsapp" | "sms" | "email" }) {
  const styles = {
    primary: "bg-forest-800 text-white hover:bg-forest-700",
    ghost: "border border-mint-200 bg-white text-ink-700 hover:bg-mint-100",
    danger: "bg-clay-100 text-clay-700",
    whatsapp: "bg-[#128C4A] text-white",
    sms: "bg-[#1D4ED8] text-white",
    email: "bg-[#6D28D9] text-white",
  }[variant];
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block font-mono text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{label}</span>
      {children}
    </label>
  );
}

const control = "min-h-12 w-full rounded-xl border border-mint-200 bg-white px-3 text-base text-ink-900 outline-none focus:border-forest-800 focus:ring-2 focus:ring-forest-800/15";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, "min-h-28 py-3", props.className)} />;
}

export function Card({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-mint-200 bg-white p-4 shadow-sm", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, detail, tone = "green" }: { label: string; value: string; detail?: string; tone?: "green" | "gold" | "red" | "blue" }) {
  const bar = { green: "bg-forest-800", gold: "bg-gold-600", red: "bg-clay-700", blue: "bg-[#153D6E]" }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-mint-200 bg-white p-4 shadow-sm">
      <div className={cx("absolute inset-x-0 top-0 h-1", bar)} />
      <p className="font-mono text-[11px] font-semibold tracking-wide text-ink-400 uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-ink-400">{detail}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: FeeStatus }) {
  const styles = {
    paid: "bg-mint-200 text-forest-900",
    partial: "bg-gold-100 text-gold-600",
    owing: "bg-clay-100 text-clay-700",
  }[status];
  const label = { paid: "Paid", partial: "Partial", owing: "Owing" }[status];
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 font-mono text-[11px] font-bold", styles)}>{label}</span>;
}

export function LogBadge({ status }: { status: MessageStatus }) {
  const styles = {
    sent: "bg-mint-200 text-forest-900",
    opened: "bg-gold-100 text-gold-600",
    failed: "bg-clay-100 text-clay-700",
  }[status];
  const label = { sent: "Sent", opened: "Opened", failed: "Failed" }[status];
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 font-mono text-[11px] font-bold", styles)}>{label}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="font-semibold text-ink-700">{title}</p>
      <p className="mt-1 text-sm text-ink-400">{body}</p>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/70 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
          </div>
          <button type="button" className="min-h-12 min-w-12 rounded-xl bg-mint-50 font-semibold" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Notice({ type, text, onDismiss }: { type: "ok" | "err"; text: string; onDismiss: () => void }) {
  const styles = type === "err" ? "bg-clay-700 text-white" : "bg-forest-900 text-white";
  return (
    <div className={cx("flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm", styles)} role={type === "err" ? "alert" : "status"}>
      <p>{text}</p>
      <button type="button" className="min-h-11 shrink-0 font-semibold underline" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
