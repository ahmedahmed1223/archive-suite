import AppShell from "@/components/AppShell";

export default function NotificationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell subtitle="الإشعارات">{children}</AppShell>;
}
