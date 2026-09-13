"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";

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
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setState("loading");
    setSrc(null);

    void api.mediaDerivativeContent(derivativeId, { accessToken }).then((response) => {
      if (!active) return;
      if (!response.ok) {
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

  return (
    <span className={className} role="status" data-state={state}>
      {state === "loading" ? loadingLabel : unavailableLabel}
    </span>
  );
}
