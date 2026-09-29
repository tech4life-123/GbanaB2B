"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils/cn";
import { sendOtp, verifyOtp, type SendOtpState, type VerifyOtpState } from "../actions";

const RESEND_SECONDS = 60;

export function PhoneSignIn({
  configured,
  next,
  role,
}: {
  configured: boolean;
  next?: string;
  role?: string;
}) {
  const [sendState, sendAction, sending] = useActionState<SendOtpState, FormData>(sendOtp, null);
  const [verifyState, verifyAction, verifying] = useActionState<VerifyOtpState, FormData>(verifyOtp, null);
  const [editing, setEditing] = useState(false);

  const sent = sendState?.ok ? sendState.data : null;
  const step: "phone" | "code" = sent && !editing ? "code" : "phone";

  if (step === "code" && sent) {
    return (
      <form action={verifyAction} className="animate-fade-in space-y-5" noValidate>
        <input type="hidden" name="phone" value={sent.phone} />
        {next && <input type="hidden" name="next" value={next} />}
        {role && <input type="hidden" name="role" value={role} />}

        <div className="flex items-start gap-3 rounded-md bg-trade-50 px-4 py-3">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-trade-600" aria-hidden="true" />
          <p className="text-sm text-trade-800">
            We sent a 6-digit code to <span className="tabular font-mono font-semibold">{sent.masked}</span>.
          </p>
        </div>

        <CodeField error={verifyState && !verifyState.ok ? verifyState.fieldErrors?.token : undefined} />

        {verifyState && !verifyState.ok && !verifyState.fieldErrors?.token && (
          <Alert tone="danger">{verifyState.message}</Alert>
        )}

        <Button type="submit" size="lg" className="w-full" loading={verifying}>
          Verify and continue
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 font-semibold text-trade-700 hover:text-trade-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Change number
          </button>
          <ResendButton sentAt={sent.sentAt} phone={sent.phone} action={sendAction} pending={sending} />
        </div>
      </form>
    );
  }

  const phoneError = sendState && !sendState.ok ? sendState.fieldErrors?.phone : undefined;

  return (
    <form
      action={(fd) => {
        setEditing(false);
        sendAction(fd);
      }}
      className="space-y-5"
      noValidate
    >
      <Field
        id="phone"
        label="Mobile number"
        hint="Liberian mobile number. We'll text you a sign-in code."
        error={phoneError}
      >
        <div className="flex">
          <span className="inline-flex h-11 items-center gap-1.5 rounded-l-md border border-r-0 border-line-strong bg-trade-50 px-3 text-sm font-semibold text-trade-800">
            <span className="label-caps !text-[0.625rem] text-muted">LR</span>+231
          </span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="077 012 3456"
            defaultValue={sent ? sent.phone.replace(/^\+231/, "0") : ""}
            required
            disabled={!configured}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={describedBy("phone", { hint: true, error: phoneError })}
            className="tabular rounded-l-none font-mono tracking-wide"
          />
        </div>
      </Field>

      {sendState && !sendState.ok && !phoneError && (
        <Alert tone={sendState.code === "RATE_LIMITED" ? "warning" : "danger"}>{sendState.message}</Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={sending}
        disabled={!configured}
        icon={!sending ? <ArrowRight className="order-last size-5" aria-hidden="true" /> : undefined}
      >
        Send code
      </Button>
    </form>
  );
}

function CodeField({ error }: { error?: string }) {
  return (
    <Field id="token" label="Verification code" error={error}>
      <Input
        id="token"
        name="token"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        placeholder="••••••"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy("token", { error })}
        onInput={(e) => {
          const el = e.currentTarget;
          el.value = el.value.replace(/\D/g, "").slice(0, 6);
        }}
        className="tabular h-14 text-center font-mono !text-2xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em]"
      />
    </Field>
  );
}

function ResendButton({
  sentAt,
  phone,
  action,
  pending,
}: {
  sentAt: number;
  phone: string;
  action: (fd: FormData) => void;
  pending: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  return (
    <button
      type="button"
      disabled={remaining > 0 || pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("phone", phone);
        startTransition(() => action(fd));
      }}
      className={cn(
        "font-semibold",
        remaining > 0 ? "cursor-not-allowed text-muted" : "text-signal-700 hover:text-signal-800",
      )}
    >
      {pending ? "Sending…" : remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
    </button>
  );
}
