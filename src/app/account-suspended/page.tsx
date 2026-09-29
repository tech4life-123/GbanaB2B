import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

export default function AccountSuspendedPage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-red-50 text-red-700">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-trade-900">Your account is suspended</h1>
      <p className="mt-2 max-w-md text-muted">
        An administrator has paused this account. Any funds held in escrow stay protected. Contact GbanaB2B support to
        resolve this.
      </p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
