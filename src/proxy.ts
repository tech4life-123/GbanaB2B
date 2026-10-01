import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/db/supabase/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  // Lets a person quote one id to support and lets us find that request in the platform logs.
  response.headers.set("x-request-id", crypto.randomUUID());
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation, PWA files and public images.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)$).*)",
  ],
};
