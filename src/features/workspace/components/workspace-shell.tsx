"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, Menu, Plus, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils/cn";
import { ROLE_META, type Role } from "@/lib/auth/roles";
import { signOut } from "@/features/auth/actions";
import { CURRENT_PHASE, NAV, navHref, type NavItem } from "../nav";
import { RoleIcon } from "../role-icon";

export interface ShellViewer {
  name: string;
  phone: string;
  roles: Role[];
}

/** <details> menus stay open across client-side navigations unless closed explicitly. */
function closeMenu(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

function isActive(pathname: string, role: Role, item: NavItem) {
  const href = navHref(role, item.segment);
  return item.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "G";
}

/**
 * Workspace chrome: navy sidebar on desktop; compact top bar + bottom tab bar
 * on phones (thumb-reachable, 4 primary destinations + menu).
 */
export function WorkspaceShell({ role, viewer, children }: { role: Role; viewer: ShellViewer; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = NAV[role];
  const primary = items.filter((i) => i.primary).slice(0, 4);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="bg-manifest sticky top-0 hidden h-dvh flex-col text-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={ROLE_META[role].home} className="rounded-md" aria-label="Workspace home">
            <Logo tone="light" />
          </Link>
        </div>
        <div className="px-3">
          <RoleSwitcher role={role} roles={viewer.roles} />
        </div>
        <nav aria-label={`${ROLE_META[role].label} workspace`} className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.segment}>
                <SidebarLink role={role} item={item} active={isActive(pathname, role, item)} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-3">
          <UserBlock viewer={viewer} />
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
          <Link href={ROLE_META[role].home} aria-label="Workspace home" className="rounded-md">
            <LogoMark className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="label-caps !text-[0.625rem] text-muted">Workspace</p>
            <p className="-mt-0.5 truncate text-sm font-bold text-trade-900">{ROLE_META[role].label}</p>
          </div>
          <MobileMenu role={role} viewer={viewer} pathname={pathname} />
        </header>

        <main id="main" className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="grid grid-cols-4">
            {primary.map((item) => {
              const active = isActive(pathname, role, item);
              const Icon = item.icon;
              return (
                <li key={item.segment}>
                  <Link
                    href={navHref(role, item.segment)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold",
                      active ? "text-trade-900" : "text-muted",
                    )}
                  >
                    {active && <span className="absolute top-0 h-0.5 w-10 rounded-b bg-signal-500" aria-hidden="true" />}
                    <Icon className={cn("size-5", active && "text-signal-600")} aria-hidden="true" />
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function SidebarLink({ role, item, active }: { role: Role; item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const planned = item.phase > CURRENT_PHASE;
  return (
    <Link
      href={navHref(role, item.segment)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-white/10 text-white" : "text-trade-200 hover:bg-white/5 hover:text-white",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-signal-500" aria-hidden="true" />}
      <Icon className={cn("size-[1.1rem] shrink-0", active ? "text-signal-400" : "text-trade-300 group-hover:text-trade-100")} aria-hidden="true" />
      <span className="flex-1 truncate">{item.label}</span>
      {planned && (
        <span className="rounded-sm bg-white/5 px-1.5 py-px font-mono text-[0.625rem] text-trade-300" title={`Arrives in phase ${item.phase}`}>
          P{item.phase}
        </span>
      )}
    </Link>
  );
}

function RoleSwitcher({ role, roles }: { role: Role; roles: Role[] }) {
  const others = roles.filter((r) => r !== role);
  const canAdd = (["buyer", "seller", "carrier"] as const).some((r) => !roles.includes(r));
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 place-items-center rounded-md bg-signal-500 text-trade-900">
          <RoleIcon role={role} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-caps block !text-[0.625rem] text-trade-300">Workspace</span>
          <span className="block truncate text-sm font-bold">{ROLE_META[role].label}</span>
        </span>
        <ChevronsUpDown className="size-4 text-trade-300" aria-hidden="true" />
      </summary>
      <div className="absolute inset-x-0 z-20 mt-1.5 overflow-hidden rounded-lg border border-line bg-white p-1.5 text-trade-900 shadow-raised">
        {others.length > 0 && <p className="label-caps px-2.5 pt-1.5 pb-1 text-muted">Switch to</p>}
        {others.map((r) => (
          <Link onClick={closeMenu} key={r} href={ROLE_META[r].home} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-trade-50">
            <RoleIcon role={r} className="size-4 text-trade-600" />
            {ROLE_META[r].label}
          </Link>
        ))}
        {canAdd && (
          <Link
 onClick={closeMenu}
            href="/onboarding"
            className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-signal-700 hover:bg-signal-50", others.length > 0 && "mt-1 border-t border-line")}
          >
            <Plus className="size-4" aria-hidden="true" /> Add a role
          </Link>
        )}
        {others.length === 0 && !canAdd && <p className="px-2.5 py-2 text-sm text-muted">This is your only workspace.</p>}
      </div>
    </details>
  );
}

function UserBlock({ viewer, light = false }: { viewer: ShellViewer; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
          light ? "bg-trade-900 text-white" : "bg-white/10 text-white ring-1 ring-white/15",
        )}
        aria-hidden="true"
      >
        {initials(viewer.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", light ? "text-trade-900" : "text-white")}>{viewer.name}</p>
        <p className={cn("tabular truncate font-mono text-xs", light ? "text-muted" : "text-trade-300")}>{viewer.phone}</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className={cn(
            "grid size-9 place-items-center rounded-md",
            light ? "text-muted hover:bg-trade-50 hover:text-trade-900" : "text-trade-300 hover:bg-white/10 hover:text-white",
          )}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function MobileMenu({ role, viewer, pathname }: { role: Role; viewer: ShellViewer; pathname: string }) {
  return (
    <details className="group">
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-md text-trade-900 hover:bg-trade-50 [&::-webkit-details-marker]:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-5 group-open:block" aria-hidden="true" />
      </summary>
      <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto bg-canvas px-4 pt-4 pb-24">
        <RoleSwitcherMobile role={role} roles={viewer.roles} />
        <ul className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
          {NAV[role].map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, role, item);
            return (
              <li key={item.segment} className="border-b border-line last:border-0">
                <Link
 onClick={closeMenu}
                  href={navHref(role, item.segment)}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-13 items-center gap-3 px-4 text-[0.9375rem] font-medium", active ? "bg-trade-50 text-trade-900" : "text-trade-800")}
                >
                  <Icon className={cn("size-5", active ? "text-signal-600" : "text-trade-400")} aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.phase > CURRENT_PHASE && <span className="font-mono text-[0.6875rem] text-muted">Phase {item.phase}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 rounded-lg border border-line bg-white p-3">
          <UserBlock viewer={viewer} light />
        </div>
      </div>
    </details>
  );
}

function RoleSwitcherMobile({ role, roles }: { role: Role; roles: Role[] }) {
  const canAdd = (["buyer", "seller", "carrier"] as const).some((r) => !roles.includes(r));
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {roles.map((r) => (
        <Link
 onClick={closeMenu}
          key={r}
          href={ROLE_META[r].home}
          aria-current={r === role ? "true" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
            r === role ? "border-trade-900 bg-trade-900 text-white" : "border-line-strong bg-white text-trade-800",
          )}
        >
          <RoleIcon role={r} className="size-4" />
          {ROLE_META[r].label}
        </Link>
      ))}
      {canAdd && (
        <Link onClick={closeMenu} href="/onboarding" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-sm font-semibold text-signal-700">
          <Plus className="size-4" aria-hidden="true" /> Add role
        </Link>
      )}
    </div>
  );
}
