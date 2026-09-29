import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation, PWA files and public images.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)$).*)",
  ],
};
