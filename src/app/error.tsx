"use client";

import { RouteStatus } from "@/components/route-status";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const detail = error.message || "The page could not be shown.";
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center p-6">
      <RouteStatus
        tone="error"
        title="Something went wrong"
        body={error.digest ? `${detail} Reference ${error.digest}.` : detail}
        action={
          <>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 font-semibold text-clay-700"
              onClick={() => reset()}
            >
              Try again
            </button>
            <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-4 font-semibold text-white">
              Back to sign in
            </a>
          </>
        }
      />
    </main>
  );
}
