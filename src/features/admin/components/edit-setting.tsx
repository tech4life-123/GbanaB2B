"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { updateSetting, type SettingState } from "../actions";

export function EditSettingButton({
  settingKey,
  label,
  kind,
  current,
  min,
  max,
  unit,
}: {
  settingKey: string;
  label: string;
  kind: "number" | "string" | "boolean";
  current: string;
  min: number | null;
  max: number | null;
  unit?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SettingState, FormData>(updateSetting, null);
  const inputId = `setting-${settingKey}`;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} icon={<Pencil className="size-3.5" aria-hidden="true" />}>
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Change ${label.toLowerCase()}`}
        description="Changes apply to new transactions only. Existing orders keep the values they were created with."
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="key" value={settingKey} />
          <input type="hidden" name="kind" value={kind} />
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-sm font-semibold text-trade-900">
              New value {unit && <span className="font-normal text-muted">({unit})</span>}
            </label>
            <Input
              id={inputId}
              name="value"
              defaultValue={current}
              inputMode={kind === "number" ? "decimal" : undefined}
              className="tabular font-mono"
              aria-describedby={`${inputId}-bounds`}
              required
            />
            {(min !== null || max !== null) && (
              <p id={`${inputId}-bounds`} className="text-[0.8125rem] text-muted">
                Allowed range: {min ?? "−∞"} – {max ?? "∞"}
              </p>
            )}
          </div>
          {state && (
            <Alert tone={state.ok ? "success" : "danger"}>{state.ok ? state.message : state.message}</Alert>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {state?.ok ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" variant="secondary" loading={pending}>
              Save change
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
