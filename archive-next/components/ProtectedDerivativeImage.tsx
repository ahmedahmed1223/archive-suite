"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, rightsRefusal, type RightsRefusal } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const DECISION_COPY = {
  no_record: "noRecord",
  no_window_for_usage: "noWindowForUsage",
  unknown_window: "unknownWindow",
} as const;

export interface ProtectedDerivativeImageProps {
  derivativeId: string;
  accessToken?: string;
  alt: string;
  className?: string;
  loadingLabel?: string;
  unavailableLabel?: string;
}

/**
 * Displays an authenticated derivative without ever putting its storage key in
 * the DOM. The object URL is local to the active component and is revoked when
 * the derivative changes or the component leaves the page.
 */
export default function ProtectedDerivativeImage({
  derivativeId,
  accessToken,
  alt,
  className,
  loadingLabel = "Loading preview",
  unavailableLabel = "Preview unavailable",
}: ProtectedDerivativeImageProps) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const { t } = useLocale();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [src, setSrc] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<RightsRefusal | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setState("loading");
    setSrc(null);
    setRefusal(null);

    void api.mediaDerivativeContent(derivativeId, { accessToken }).then((response) => {
      if (!active) return;
      if (!response.ok) {
        const refusalInfo = rightsRefusal(response);
        if (refusalInfo) {
          setRefusal(refusalInfo);
        }
        setState("unavailable");
        return;
      }

      objectUrl = URL.createObjectURL(response.blob);
      setSrc(objectUrl);
      setState("ready");
    }).catch(() => {
      if (active) setState("unavailable");
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, api, derivativeId]);

  if (state === "ready" && src) {
    return <img className={className} src={src} alt={alt} />;
  }

  let displayText = unavailableLabel;
  if (refusal) {
    const copy = t.shared.rightsRefusal;
    const known = DECISION_COPY[refusal.decidedBy as keyof typeof DECISION_COPY];
    displayText = known ? copy[known] : refusal.reason;
  }

  return (
    <span className={className} role="status" data-state={state} data-decided-by={refusal?.decidedBy}>
      {state === "loading" ? loadingLabel : displayText}
    </span>
  );
}
