"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";
import { AuthGate, AuthProvider } from "@/lib/auth-session";

export default function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={180}>
          <ToastProvider swipeDirection="right">
            <AuthGate>{children}</AuthGate>
            <CommandPalette />
            <ToastViewport />
          </ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
