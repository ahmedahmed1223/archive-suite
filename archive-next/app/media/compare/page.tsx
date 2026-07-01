"use client";

import { useCallback, useRef, useState } from "react";
import MediaPlayer from "@/components/MediaPlayer";

type SyncMode = "off" | "on";

export default function ComparePage() {
  const [pathA, setPathA] = useState("");
  const [pathB, setPathB] = useState("");
  const [syncMode, setSyncMode] = useState<SyncMode>("off");
  const [error, setError] = useState<string | null>(null);

  const playerARef = useRef<HTMLMediaElement | null>(null);
  const playerBRef = useRef<HTMLMediaElement | null>(null);
  const isSyncingRef = useRef(false);
  const TIME_THRESHOLD = 0.3; // Guard against micro-differences (seconds)

  // Handler for A seeking/playing — mirror to B if sync is on
  const handleATimeUpdate = useCallback(() => {
    if (syncMode === "off" || isSyncingRef.current || !playerBRef.current) return;

    const timeDiff = Math.abs(
      (playerARef.current?.currentTime ?? 0) - (playerBRef.current.currentTime ?? 0)
    );

    if (timeDiff > TIME_THRESHOLD) {
      isSyncingRef.current = true;
      playerBRef.current.currentTime = playerARef.current?.currentTime ?? 0;
      isSyncingRef.current = false;
    }
  }, [syncMode]);

  const handleAPlayPause = useCallback(() => {
    if (syncMode === "off" || isSyncingRef.current || !playerBRef.current) return;

    isSyncingRef.current = true;
    const isPlayingA = !playerARef.current?.paused;
    if (isPlayingA) {
      playerBRef.current.play().catch(() => {
        // Ignore autoplay errors (browser policy)
      });
    } else {
      playerBRef.current.pause();
    }
    isSyncingRef.current = false;
  }, [syncMode]);

  // Handler for B seeking/playing — mirror to A if sync is on
  const handleBTimeUpdate = useCallback(() => {
    if (syncMode === "off" || isSyncingRef.current || !playerARef.current) return;

    const timeDiff = Math.abs(
      (playerBRef.current?.currentTime ?? 0) - (playerARef.current.currentTime ?? 0)
    );

    if (timeDiff > TIME_THRESHOLD) {
      isSyncingRef.current = true;
      playerARef.current.currentTime = playerBRef.current?.currentTime ?? 0;
      isSyncingRef.current = false;
    }
  }, [syncMode]);

  const handleBPlayPause = useCallback(() => {
    if (syncMode === "off" || isSyncingRef.current || !playerARef.current) return;

    isSyncingRef.current = true;
    const isPlayingB = !playerBRef.current?.paused;
    if (isPlayingB) {
      playerARef.current.play().catch(() => {
        // Ignore autoplay errors (browser policy)
      });
    } else {
      playerARef.current.pause();
    }
    isSyncingRef.current = false;
  }, [syncMode]);

  const attachMediaListeners = useCallback(
    (player: HTMLMediaElement | null, side: "a" | "b") => {
      if (!player) return;

      const timeUpdateHandler = side === "a" ? handleATimeUpdate : handleBTimeUpdate;
      const playPauseHandler = side === "a" ? handleAPlayPause : handleBPlayPause;

      player.addEventListener("timeupdate", timeUpdateHandler);
      player.addEventListener("play", playPauseHandler);
      player.addEventListener("pause", playPauseHandler);

      return () => {
        player.removeEventListener("timeupdate", timeUpdateHandler);
        player.removeEventListener("play", playPauseHandler);
        player.removeEventListener("pause", playPauseHandler);
      };
    },
    [handleATimeUpdate, handleAPlayPause, handleBTimeUpdate, handleBPlayPause]
  );

  const handlePlayerAReady = useCallback(
    (el: HTMLMediaElement) => {
      playerARef.current = el;
      attachMediaListeners(el, "a");
    },
    [attachMediaListeners]
  );

  const handlePlayerBReady = useCallback(
    (el: HTMLMediaElement) => {
      playerBRef.current = el;
      attachMediaListeners(el, "b");
    },
    [attachMediaListeners]
  );

  const isValidPaths = pathA.trim() && pathB.trim();

  return (
    <div className="max-w-7xl mx-auto p-6" dir="rtl">
      <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        مقارنة الوسائط
      </h1>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Input Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Path A */}
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            مسار الملف أ
          </label>
          <input
            type="text"
            value={pathA}
            onChange={(e) => {
              setPathA(e.target.value);
              setError(null);
            }}
            placeholder="مثال: /archive/media/file-a.mp4"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
            }}
          />
        </div>

        {/* Path B */}
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            مسار الملف ب
          </label>
          <input
            type="text"
            value={pathB}
            onChange={(e) => {
              setPathB(e.target.value);
              setError(null);
            }}
            placeholder="مثال: /archive/media/file-b.mp4"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>

      {/* Sync Toggle */}
      {isValidPaths && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "#f0f9ff",
            border: "1px solid #bfdbfe",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <input
            type="checkbox"
            id="sync-toggle"
            checked={syncMode === "on"}
            onChange={(e) => setSyncMode(e.target.checked ? "on" : "off")}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="sync-toggle" style={{ cursor: "pointer", fontSize: "0.875rem", marginBottom: 0 }}>
            مزامنة التشغيل
          </label>
          <span style={{ fontSize: "0.75rem", color: "#6b7280", marginInlineStart: "0.5rem" }}>
            عندما تكون مفعلة، سيتم مزامنة التشغيل والإيقاف والبحث بين المشغلين
          </span>
        </div>
      )}

      {/* Media Players */}
      {isValidPaths ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
          }}
        >
          {/* Player A */}
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>الملف أ</h2>
            <MediaPlayer path={pathA} onReady={handlePlayerAReady} />
          </div>

          {/* Player B */}
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>الملف ب</h2>
            <MediaPlayer path={pathB} onReady={handlePlayerBReady} />
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#6b7280",
            backgroundColor: "#f3f4f6",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          أدخل مساري الملفات أعلاه لبدء المقارنة
        </div>
      )}
    </div>
  );
}
