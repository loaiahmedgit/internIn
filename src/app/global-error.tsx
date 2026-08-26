"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-navy/40">
          Something went wrong
        </p>
        <h1 className="text-2xl font-semibold text-navy">
          We hit an unexpected error.
        </h1>
        <button
          onClick={() => reset()}
          className="mt-2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
