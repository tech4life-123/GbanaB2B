import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark className="size-12" />
      <p className="label-caps mt-8 text-signal-700">Error 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-trade-900">This route doesn&apos;t go anywhere</h1>
      <p className="mt-2 max-w-md text-muted">The page may have moved, or you may not have access to it.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonClasses("secondary")}>
          Go home
        </Link>
        <Link href="/sign-in" className={buttonClasses("outline")}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
