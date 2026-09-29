import { requireRole } from "@/lib/auth/session";
import { formatPhoneForDisplay } from "@/lib/validation/phone";
import type { Role } from "@/lib/auth/roles";
import { WorkspaceShell } from "./components/workspace-shell";

/**
 * Server-side gate for every workspace. `requireRole` reads roles from the
 * database for this request; the proxy's redirect is only a UX shortcut.
 */
export async function RoleWorkspace({ role, children }: { role: Role; children: React.ReactNode }) {
  const viewer = await requireRole(role);
  return (
    <WorkspaceShell
      role={role}
      viewer={{
        name: viewer.profile?.display_name || viewer.profile?.full_name || "Your account",
        phone: viewer.phone ? formatPhoneForDisplay(viewer.phone) : "",
        roles: viewer.roles,
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
