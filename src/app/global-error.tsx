"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F2F7F4", color: "#0C1810", fontFamily: "Outfit, system-ui, sans-serif" }}>
        <main style={{ maxWidth: "28rem", padding: "1.5rem", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#07421F" }}>SchoolLedger GH</p>
          <h1 style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>Something went wrong</h1>
          <p style={{ color: "#3d4f44" }}>The report sent from this screen does not include names, phone numbers, or messages.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ minHeight: "3rem", marginTop: "0.5rem", padding: "0 1.25rem", border: 0, borderRadius: "0.75rem", background: "#07421F", color: "#fff", font: "inherit", fontWeight: 600 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
