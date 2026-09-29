"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Shows the digest (safe to share) but never the raw error message. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="label-caps text-red-700">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-trade-900">We couldn&apos;t load this page</h1>
      <p className="mt-2 max-w-md text-muted">
        Check your connection and try again. If it keeps happening, contact support
        {error.digest ? (
          <>
            {" "}
            with reference <span className="font-mono text-trade-900">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <Button onClick={reset} variant="secondary" className="mt-6" icon={<RotateCw className="size-4" aria-hidden="true" />}>
        Try again
      </Button>
    </main>
  );
}
