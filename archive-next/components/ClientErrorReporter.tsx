"use client";

import { useEffect } from "react";
import { recordClientError } from "@/lib/client-error-log";

function reasonMessage(reason: unknown) {
  if (reason instanceof Error) {
    return {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    };
  }

  if (typeof reason === "string") {
    return {
      name: "UnhandledRejection",
      message: reason
    };
  }

  return {
    name: "UnhandledRejection",
    message: "Unhandled promise rejection"
  };
}

export default function ClientErrorReporter() {
  useEffect(() => {
    const page = () => `${window.location.pathname}${window.location.search}`;

    const onError = (event: ErrorEvent) => {
      recordClientError({
        name: event.error instanceof Error ? event.error.name : "WindowError",
        message: event.message,
        page: page(),
        source: "window-error",
        stack: event.error instanceof Error ? event.error.stack : undefined
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const report = reasonMessage(event.reason);
      recordClientError({
        ...report,
        page: page(),
        source: "unhandled-rejection"
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
