import type { Metadata } from "next";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archive Suite",
  description: "واجهة إدارة الأرشيف والوسائط في Archive Suite"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
