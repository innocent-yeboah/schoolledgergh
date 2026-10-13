import type { ReactNode } from "react";

export function RouteStatus({
  title,
  body,
  tone = "loading",
  action,
}: {
  title: string;
  body: string;
  tone?: "loading" | "error";
  action?: ReactNode;
}) {
  const error = tone === "error";
  return (
    <section
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className={
        error
          ? "rounded-2xl bg-clay-700 px-5 py-8 text-white shadow-sm"
          : "rounded-2xl border border-mint-200 bg-white px-5 py-8 text-ink-900 shadow-sm"
      }
    >
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className={`mt-2 text-sm ${error ? "text-white/90" : "text-ink-700"}`}>{body}</p>
      {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
    </section>
  );
}
