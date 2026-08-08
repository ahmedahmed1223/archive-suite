"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/lib/auth-session";
import { useLocale } from "./LocaleProvider";
import type { AppLocale } from "./types";

export function LocaleAccountSync() {
  const { status, user } = useAuthSession();
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const lastAppliedLocale = useRef<AppLocale | null>(null);

  useEffect(() => {
    const accountLocale = user?.locale ?? null;

    if (status !== "authenticated" || !accountLocale || accountLocale === locale) {
      return;
    }

    if (lastAppliedLocale.current === accountLocale) {
      return;
    }

    lastAppliedLocale.current = accountLocale;
    setLocale(accountLocale);
    router.refresh();
  }, [locale, router, setLocale, status, user?.locale]);

  return null;
}
