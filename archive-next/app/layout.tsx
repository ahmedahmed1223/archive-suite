import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import { BRAND } from "@/lib/brand";
import "./styles/01-base.css";
import "./styles/02-layout.css";
import "./styles/03-components.css";
import "./styles/04-tables.css";
import "./styles/05-status.css";
import "./styles/06-widgets.css";
import "./styles/07-ui-kit.css";
import "./styles/08-foundation.css";
import "./styles/09-focus-contextual.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap"
});

export const metadata: Metadata = {
  title: `${BRAND.arabicName} | ${BRAND.latinName}`,
  description: `${BRAND.descriptor} في ${BRAND.lockupName}`,
  applicationName: BRAND.latinName,
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark" className={plexArabic.variable} suppressHydrationWarning>
      <body>
        <AppProviders>
          <ClientErrorReporter />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
