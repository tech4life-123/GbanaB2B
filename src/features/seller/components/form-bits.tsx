"use client";

import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "../actions";

/** Success/error banner for a section form; moves focus to errors so screen readers hear them. */
export function FormMessage({ state }: { state: FormState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && !state.ok) ref.current?.focus();
  }, [state]);
  if (!state) return null;
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {state.ok ? (
        state.message ? <Alert tone="success">{state.message}</Alert> : null
      ) : (
        <Alert tone="danger">{state.message}</Alert>
      )}
    </div>
  );
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}
