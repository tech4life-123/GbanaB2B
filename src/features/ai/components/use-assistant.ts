"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";
import type { AiRun } from "../run";

/** Runs one assistant action and keeps the last answer, error and remaining quota. */
export function useAssistant<T>() {
  const [pending, start] = useTransition();
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  function run(call: () => Promise<ActionResult<AiRun<T>>>) {
    setError(null);
    start(async () => {
      try {
        const r = await call();
        if (r.ok) {
          setValue(r.data.value);
          setRemaining(r.data.remaining);
        } else {
          setError(r.message);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }
  return { pending, value, error, remaining, run };
}
