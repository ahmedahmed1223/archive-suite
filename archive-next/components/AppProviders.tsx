"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";
import ToastHub from "@/components/ui/ToastHub";
import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthGate, AuthProvider } from "@/lib/auth-session";
import { initializeOfflineManager, shutdownOfflineManager } from "@/lib/offline-manager";

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

  useEffect(() => {
    // Initialize offline/degraded mode system
    initializeOfflineManager();

    return () => {
      shutdownOfflineManager();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={180}>
            <ToastProvider swipeDirection="right">
              <ConfirmDialogProvider>
                <OfflineStatusBanner />
                <AuthGate>{children}</AuthGate>
                <CommandPalette />
                <ToastHub />
                <ToastViewport />
              </ConfirmDialogProvider>
            </ToastProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
