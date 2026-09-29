import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { isSelfAssignableRole, ROLE_META, SELF_ASSIGNABLE_ROLES } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/security/redirect";
import { formatPhoneForDisplay } from "@/lib/validation/phone";
import { AddRoleForm, OnboardingForm } from "@/features/onboarding/components/role-picker";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await requireViewer("/onboarding");
  const onboarded = viewer.roles.length > 0 && Boolean(viewer.profile?.onboarded_at);
  const role = isSelfAssignableRole(params.role) ? params.role : undefined;
  const add = isSelfAssignableRole(params.add) ? params.add : undefined;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "") : "";

  if (onboarded) {
    if (add && viewer.roles.includes(add)) redirect(ROLE_META[add].home);
    const addable = SELF_ASSIGNABLE_ROLES.filter((r) => !viewer.roles.includes(r));
    if (addable.length === 0) redirect(viewer.homeRole ? ROLE_META[viewer.homeRole].home : "/");

    return (
      <div className="animate-fade-in">
        <p className="label-caps text-signal-700">Add a role</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-trade-900">
          {add ? `Use GbanaB2B as a ${ROLE_META[add].label.toLowerCase()}` : "Add another workspace"}
        </h1>
        <p className="mt-2 text-muted">
          One account can buy, sell and carry. Each role gets its own workspace.
        </p>
        <div className="mt-8 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
          <AddRoleForm defaultRole={add} held={viewer.roles} />
        </div>
        {viewer.homeRole && (
          <p className="mt-6 text-center text-sm">
            <Link href={ROLE_META[viewer.homeRole].home} className="font-semibold text-trade-700 hover:text-trade-900">
              Back to my {ROLE_META[viewer.homeRole].label.toLowerCase()} workspace
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <p className="label-caps text-signal-700">Step 2 of 2 · Your account</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-trade-900">Set up your account</h1>
      <p className="mt-2 text-muted">
        Signed in as{" "}
        <span className="tabular font-mono font-semibold text-trade-900">
          {viewer.phone ? formatPhoneForDisplay(viewer.phone) : "your phone"}
        </span>
        . Business details come next, when you create your first listing or order.
      </p>
      <div className="mt-8 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
        <OnboardingForm
          defaultRole={role ?? add}
          defaultName={viewer.profile?.full_name ?? undefined}
          next={next || undefined}
        />
      </div>
    </div>
  );
}
