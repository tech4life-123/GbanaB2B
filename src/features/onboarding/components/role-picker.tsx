"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { RoleIcon } from "@/features/workspace/role-icon";
import { ROLE_META, SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/lib/auth/roles";
import { addRole, completeOnboarding, type OnboardingState } from "../actions";

const ROLE_NOTES: Record<SelfAssignableRole, string> = {
  buyer: "Browse, order in bulk and pay into escrow.",
  seller: "List stock with MOQs and tier pricing.",
  carrier: "Bid on loads once our team verifies your licence and vehicle.",
};

function RoleOptions({
  defaultRole,
  exclude = [],
  error,
}: {
  defaultRole?: SelfAssignableRole;
  exclude?: readonly string[];
  error?: string;
}) {
  const options = SELF_ASSIGNABLE_ROLES.filter((r) => !exclude.includes(r));
  return (
    <fieldset aria-describedby={error ? "role-error" : undefined}>
      <legend className="text-sm font-semibold text-trade-900">How will you use GbanaB2B?</legend>
      <p className="mt-0.5 text-[0.8125rem] text-muted">Pick one to start — you can add the others later.</p>
      <div className="mt-3 grid gap-2.5">
        {options.map((r) => (
          <label
            key={r}
            className="group relative flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong bg-white p-4 transition-colors hover:border-trade-400 has-[:checked]:border-trade-900 has-[:checked]:bg-trade-50/60 has-[:checked]:ring-1 has-[:checked]:ring-trade-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-500"
          >
            <input
              type="radio"
              name="role"
              value={r}
              defaultChecked={r === defaultRole}
              className="peer sr-only"
              required
            />
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-trade-900 text-signal-400">
              <RoleIcon role={r} className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-trade-900">{ROLE_META[r].label}</span>
              <span className="mt-0.5 block text-sm text-muted">{ROLE_META[r].pitch}</span>
              <span className="mt-1.5 block text-xs text-trade-600">{ROLE_NOTES[r]}</span>
            </span>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-strong text-white peer-checked:border-trade-900 peer-checked:bg-trade-900">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id="role-error" className="mt-2 text-[0.8125rem] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function OnboardingForm({
  defaultRole,
  defaultName,
  next,
}: {
  defaultRole?: SelfAssignableRole;
  defaultName?: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-6" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="fullName" label="Your full name" hint="As it appears on your ID — used on invoices." error={errors.fullName}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={defaultName}
          required
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy("fullName", { hint: true, error: errors.fullName })}
        />
      </Field>

      <RoleOptions defaultRole={defaultRole} error={errors.role} />

      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.message}</Alert>}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create my workspace
      </Button>
    </form>
  );
}

export function AddRoleForm({ defaultRole, held }: { defaultRole?: SelfAssignableRole; held: readonly string[] }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(addRole, null);
  return (
    <form action={action} className="space-y-6">
      <RoleOptions defaultRole={defaultRole} exclude={held} />
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Add role
      </Button>
    </form>
  );
}
