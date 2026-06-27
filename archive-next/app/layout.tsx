import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archive Suite Next",
  description: "Next.js migration shell for Archive Suite"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
