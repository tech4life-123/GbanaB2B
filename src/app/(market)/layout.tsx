import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getViewer } from "@/lib/auth/session";
import { ROLE_META } from "@/lib/auth/roles";

/** Marketplace pages: same chrome as the public site, but session-aware. */
export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const home = viewer?.homeRole ? ROLE_META[viewer.homeRole].home : viewer ? "/onboarding" : null;
  return (
    <>
      <SiteHeader account={home ? { home } : null} />
      <main id="main" className="min-h-[70dvh] bg-canvas">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
