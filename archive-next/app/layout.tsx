import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { headers } from "next/headers";
import AppProviders from "@/components/AppProviders";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import { BRAND } from "@/lib/brand";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { directionFor } from "@/lib/i18n/resolve-locale";
import { isAppLocale } from "@/lib/i18n/types";
import "./styles/01-base.css";
import "./styles/02-layout.css";
import "./styles/03-components.css";
import "./styles/04-tables.css";
import "./styles/05-status.css";
import "./styles/06-widgets.css";
import "./styles/07-ui-kit.css";
import "./styles/08-foundation.css";
import "./styles/09-focus-contextual.css";
import "./styles/10-motion.css";
import "./notifications/notifications.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap"
});

export function metadataDescription(locale: "ar" | "en"): string {
  return getDictionary(locale).auth.login.description;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedLocale = requestHeaders.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale) ? forwardedLocale : "ar";

  return {
    title: `${BRAND.arabicName} | ${BRAND.latinName}`,
    description: metadataDescription(locale),
    applicationName: BRAND.latinName,
    icons: {
      icon: [
        {
          url: "/brand/masar-mark-2026.png?v=20260801",
          type: "image/png",
          sizes: "1254x1254"
        }
      ],
      shortcut: "/brand/masar-mark-2026.png?v=20260801",
      apple: "/brand/masar-mark-2026.png?v=20260801"
    }
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const forwardedLocale = requestHeaders.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale) ? forwardedLocale : "ar";
  const hasLocaleCookie = requestHeaders.get("x-archive-locale-cookie") === "1";

  return (
    <html lang={locale} dir={directionFor(locale)} data-theme="dark" className={plexArabic.variable} suppressHydrationWarning>
      <body>
        <AppProviders initialLocale={locale} hasLocaleCookie={hasLocaleCookie}>
          <ClientErrorReporter />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
