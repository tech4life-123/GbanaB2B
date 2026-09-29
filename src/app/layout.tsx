import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { siteConfig } from "@/config/site";
import { ConnectionStatus, ServiceWorkerRegistration } from "@/components/pwa/pwa";
import "./globals.css";

// Self-hosted variable fonts (SIL OFL): no third-party request, latin subset only.
const archivo = localFont({
  src: "../fonts/archivo-var.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

const jetbrains = localFont({
  src: "../fonts/jetbrains-mono-var.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
  // Mono is used for figures and labels; not worth blocking first paint.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    locale: "en_LR",
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-md bg-signal-500 px-4 py-2 font-semibold text-trade-900 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
        <ConnectionStatus />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
