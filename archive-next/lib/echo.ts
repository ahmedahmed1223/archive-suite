"use client";

import Echo from "laravel-echo";
import Pusher, { type ChannelAuthorizationCallback } from "pusher-js";

type ChannelAuthorizationData = NonNullable<Parameters<ChannelAuthorizationCallback>[1]>;

// ponytail: module-level singleton — one socket per browser tab is enough,
// add per-instance teardown only if multiple concurrent Echo configs are needed.
let echoInstance: Echo<"reverb"> | null = null;

export interface CreateEchoOptions {
  accessToken?: string;
  authEndpoint?: string;
}

/**
 * Lazily creates (or reuses) the singleton Laravel Echo client wired to
 * Reverb over the pusher protocol. Reads NEXT_PUBLIC_REVERB_* env vars.
 * Returns null when the Reverb key isn't configured, so callers can fall
 * back to polling.
 */
export function getEchoClient(options?: CreateEchoOptions): Echo<"reverb"> | null {
  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  if (!key) return null;

  if (echoInstance) return echoInstance;

  (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

  const authEndpoint = options?.authEndpoint ?? "/api/v1/broadcasting/auth";

  echoInstance = new Echo({
    broadcaster: "reverb",
    key,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost",
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http") === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint,
    // Custom authorizer: the archive API authenticates via the va_refresh
    // HttpOnly cookie (see AuthenticateArchiveApiRequest), so the channel
    // auth request needs credentials: "include", which pusher-js's default
    // XHR authorizer does not set.
    authorizer: (channel: { name: string }) => ({
      authorize: (
        socketId: string,
        callback: (error: Error | null, data: ChannelAuthorizationData | null) => void
      ) => {
        fetch(authEndpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
          },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name })
        })
          .then(async (response) => {
            if (!response.ok) {
              callback(new Error(`Channel auth failed with status ${response.status}`), null);
              return;
            }
            callback(null, (await response.json()) as ChannelAuthorizationData);
          })
          .catch((error: unknown) => {
            callback(error instanceof Error ? error : new Error("Channel auth request failed"), null);
          });
      }
    })
  });

  return echoInstance;
}

export function disconnectEchoClient(): void {
  echoInstance?.disconnect();
  echoInstance = null;
}
