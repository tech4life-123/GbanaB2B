import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Product photos are served from Supabase Storage's public bucket.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

/**
 * Content-Security-Policy (production only; the dev server needs eval).
 * Next.js inlines small bootstrap scripts, so script-src keeps 'unsafe-inline'
 * until a nonce pipeline is added; everything else is locked to this site and
 * the project's own Supabase host. See docs/operations/runbook.md.
 */
function contentSecurityPolicy(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  const supa = supabaseHost ? `https://${supabaseHost}` : "";
  const supaWs = supabaseHost ? `wss://${supabaseHost}` : "";
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supa}`.trim(),
    `media-src 'self' blob: ${supa}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supa} ${supaWs}`.trim().replace(/\s+/g, " "),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Small, modern formats first — images are the heaviest thing on a 3G connection.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 828, 1080, 1280],
    imageSizes: [96, 160, 240, 320],
    // 60 for grid thumbnails on slow networks, 75 for the product gallery.
    qualities: [60, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/product-images/**" }]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...(contentSecurityPolicy() ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy()! }] : [])] },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
