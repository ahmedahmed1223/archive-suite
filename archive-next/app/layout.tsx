import type { Metadata } from "next";
import AppProviders from "@/components/AppProviders";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import { BRAND } from "@/lib/brand";
import "./globals.css";

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
    <html lang="ar" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <body>
        <AppProviders>
          <ClientErrorReporter />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
