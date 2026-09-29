import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/config/env";
import { isTemporaryAccessEnabled } from "@/config/env.server";
import { PasswordSignIn } from "@/features/auth/components/password-sign-in";
import { PhoneSignIn } from "@/features/auth/components/phone-sign-in";
import { getViewer } from "@/lib/auth/session";
import { isSelfAssignableRole, ROLE_META } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";
  const role = isSelfAssignableRole(params.role) ? params.role : undefined;
  const joining = params.intent === "join";

  const viewer = await getViewer();
  if (viewer) {
    if (viewer.roles.length === 0 || !viewer.profile?.onboarded_at) redirect("/onboarding");
    redirect(next || (viewer.homeRole ? ROLE_META[viewer.homeRole].home : "/"));
  }

  const configured = isSupabaseConfigured();
  const temporaryAccess = configured && isTemporaryAccessEnabled();

  return (
    <div className="animate-fade-in">
      <p className="label-caps text-signal-700">{joining ? "Create your account" : "Welcome back"}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-trade-900">
        {joining ? (role ? `Join as a ${ROLE_META[role].label.toLowerCase()}` : "Join GbanaB2B") : "Sign in"}
      </h1>
      <p className="mt-2 text-muted">
        {joining
          ? "Your phone number is your account. New and returning users sign in the same way."
          : "Enter your mobile number and we'll text you a one-time code."}
      </p>

      {!configured && (
        <Alert tone="warning" title="Sign-in isn't connected yet" className="mt-6">
          This deployment has no Supabase project configured. Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and a publishable key to enable phone sign-in. See the README.
        </Alert>
      )}

      {temporaryAccess && (
        <section
          aria-labelledby="temp-access-title"
          className="mt-8 overflow-hidden rounded-xl border border-signal-300 bg-white shadow-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-signal-200 bg-signal-50 px-5 py-3 sm:px-6">
            <h2 id="temp-access-title" className="text-sm font-bold text-trade-900">
              Temporary access
            </h2>
            <span className="label-caps text-signal-800">Pre-launch</span>
          </div>
          <div className="p-5 sm:p-6">
            <p className="mb-4 text-sm text-muted">
              SMS codes aren&apos;t switched on yet. Team members can sign in with the email and password they were given.
            </p>
            <PasswordSignIn next={next || undefined} />
          </div>
        </section>
      )}

      <div className={temporaryAccess ? "mt-6 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6" : "mt-8 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6"}>
        {temporaryAccess && <p className="label-caps mb-4 text-muted">Phone sign-in · coming soon</p>}
        <PhoneSignIn configured={configured} next={next || undefined} role={role} />
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        By continuing you agree to GbanaB2B&apos;s terms of trade. Standard SMS rates may apply.
      </p>
    </div>
  );
}
