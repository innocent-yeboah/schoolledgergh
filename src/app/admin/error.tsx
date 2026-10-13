"use client";

import { RouteStatus } from "@/components/route-status";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const detail = error.message || "This page could not be loaded.";
  return (
    <RouteStatus
      tone="error"
      title="The admin page could not be loaded"
      body={error.digest ? `${detail} Reference ${error.digest}.` : detail}
      action={
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 font-semibold text-clay-700"
          onClick={() => reset()}
        >
          Try again
        </button>
      }
    />
  );
}
