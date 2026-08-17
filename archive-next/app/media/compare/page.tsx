"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import MediaSourcePicker from "@/components/MediaSourcePicker";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import RecordVersionCompare from "./RecordVersionCompare";
import styles from "./compare.module.css";
import "../media.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type SyncMode = "off" | "on";

const TIME_THRESHOLD = 0.3;

/**
 * V3-MEDIA-004: opening this page with ?recordId= switches it into
 * record-version compare mode (real record + attachment versions, synced
 * playback, and a non-destructive clip list). Without recordId it falls
 * back to the original manual two-path comparison tool this route already
 * shipped with -- unchanged, so nothing that links to a bare /media/compare
 * regresses.
 */
export default function ComparePage() {
  const { t } = useLocale();
  const copy = t.pages.mediaCompare;
  // undefined = not yet read from the URL (avoids flashing the manual-path
  // UI before we know whether ?recordId= was actually given).
  const [recordId, setRecordId] = useState<string | null | undefined>(undefined);
  const [recordStore, setRecordStore] = useState("archive-items");
  const [pathA, setPathA] = useState("");
  const [pathB, setPathB] = useState("");
  const [syncMode, setSyncMode] = useState<SyncMode>("off");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("recordId")?.trim() ?? "";
    setRecordId(id || null);
    setRecordStore(params.get("store")?.trim() || "archive-items");
  }, []);

  const playerARef = useRef<HTMLMediaElement | null>(null);
  const playerBRef = useRef<HTMLMediaElement | null>(null);
  const isSyncingRef = useRef(false);

  const syncTime = useCallback((source: HTMLMediaElement | null, target: HTMLMediaElement | null) => {
    if (syncMode === "off" || isSyncingRef.current || !source || !target) return;
    if (Math.abs(source.currentTime - target.currentTime) <= TIME_THRESHOLD) return;

    isSyncingRef.current = true;
    target.currentTime = source.currentTime;
    isSyncingRef.current = false;
  }, [syncMode]);

  const syncPlayback = useCallback((source: HTMLMediaElement | null, target: HTMLMediaElement | null) => {
    if (syncMode === "off" || isSyncingRef.current || !source || !target) return;

    isSyncingRef.current = true;
    if (source.paused) {
      target.pause();
    } else {
      target.play().catch(() => undefined);
    }
    isSyncingRef.current = false;
  }, [syncMode]);

  const isValidPaths = pathA.trim() && pathB.trim();

  if (recordId === undefined) {
    return (
      <AppShell subtitle={t.pageTitles.mediaComparison} contentClassName={styles.compareContent} tipsPage="media-compare">
        {null}
      </AppShell>
    );
  }

  if (recordId) {
    return (
      <AppShell subtitle={t.pageTitles.mediaComparison} contentClassName={styles.compareContent} tipsPage="media-compare">
        <PageToolbar eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.versionCompare.title} description={copy.description} />
        <RecordVersionCompare recordId={recordId} store={recordStore} />
      </AppShell>
    );
  }

  return (
    <AppShell subtitle={t.pageTitles.mediaComparison} contentClassName={styles.compareContent} tipsPage="media-compare">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className={`badge ${styles.statusIndicator}`} data-status={syncMode === "on" ? "viewing" : "idle"}>
              {syncMode === "on" ? copy.syncEnabled : copy.syncDisabled}
            </span>
            <span className="badge">{isValidPaths ? copy.ready : copy.waiting}</span>
          </>
        )}
      >
        <form className={`auth-form ${styles.pathInputForm}`} aria-label={copy.pathsAriaLabel}>
          <div className={`media-compare-grid ${styles.pathInputGrid}`}>
            <label>
              {copy.fileAPath}
              <input
                type="text"
                value={pathA}
                onChange={(event) => setPathA(event.target.value)}
                placeholder="media/file-a.mp4"
                aria-label={copy.fileAPathAriaLabel}
              />
            </label>
            <MediaSourcePicker label={copy.browseFileA} onSelect={setPathA} />
            <label>
              {copy.fileBPath}
              <input
                type="text"
                value={pathB}
                onChange={(event) => setPathB(event.target.value)}
                placeholder="media/file-b.mp4"
                aria-label={copy.fileBPathAriaLabel}
              />
            </label>
            <MediaSourcePicker label={copy.browseFileB} onSelect={setPathB} />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={syncMode === "on"}
              onChange={(event) => setSyncMode(event.target.checked ? "on" : "off")}
            />
            {copy.syncLabel}
          </label>
        </form>
      </PageToolbar>

      <OperationalSafetyPanel action={copy.safetyAction} dryRun confidence={92} auditHref="/activity" />

      {isValidPaths ? (
        <div className={`media-compare-grid ${styles.playersGrid}`} aria-label={copy.playersAriaLabel}>
          <article className={`panel ${styles.playerPanel}`}>
            <div className={`panel-title-row ${styles.playerHeader}`}>
              <h2>{copy.fileA}</h2>
              <span className={`badge ${styles.sideBadge}`}>A</span>
            </div>
            <MediaPlayer
              path={pathA}
              onReady={(el) => {
                playerARef.current = el;
              }}
              onPlayPause={(el) => syncPlayback(el, playerBRef.current)}
              onTimeUpdate={(el) => syncTime(el, playerBRef.current)}
            />
          </article>

          <article className={`panel ${styles.playerPanel}`}>
            <div className={`panel-title-row ${styles.playerHeader}`}>
              <h2>{copy.fileB}</h2>
              <span className={`badge ${styles.sideBadge}`}>B</span>
            </div>
            <MediaPlayer
              path={pathB}
              onReady={(el) => {
                playerBRef.current = el;
              }}
              onPlayPause={(el) => syncPlayback(el, playerARef.current)}
              onTimeUpdate={(el) => syncTime(el, playerARef.current)}
            />
          </article>
        </div>
      ) : (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      )}
    </AppShell>
  );
}
