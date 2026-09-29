"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { signInWithPassword, type PasswordSignInState } from "../actions";

/**
 * TEMPORARY — shown only when DEMO_ACCESS_ENABLED=true on the server.
 * Signs in pre-provisioned accounts while SMS codes aren't available.
 */
export function PasswordSignIn({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<PasswordSignInState, FormData>(signInWithPassword, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="email" label="Email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", { error: errors.email })}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={describedBy("password", { error: errors.password })}
        />
      </Field>
      {state && !state.ok && !state.fieldErrors && (
        <Alert tone={state.code === "RATE_LIMITED" ? "warning" : "danger"}>{state.message}</Alert>
      )}
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="w-full"
        loading={pending}
        icon={!pending ? <KeyRound className="size-4" aria-hidden="true" /> : undefined}
      >
        Sign in with password
      </Button>
    </form>
  );
}
