import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/config/env";
import type { Database } from "@/lib/db/types";

/** Paths that require a signed-in user. Role checks happen in the layouts. */
export const PROTECTED_PREFIXES = ["/buyer", "/seller", "/carrier", "/admin", "/onboarding"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every matched request and performs
 * an OPTIMISTIC redirect for signed-out users hitting protected paths.
 * This is a UX convenience, not the security boundary: layouts re-check the
 * user and role on the server, and RLS protects the data itself.
 */
export async function updateSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  let response = NextResponse.next({ request });

  if (!config) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      return redirectToSignIn(request);
    }
    return response;
  }

  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims — it validates
  // the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && isProtectedPath(request.nextUrl.pathname)) {
    return redirectToSignIn(request);
  }

  return response;
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
