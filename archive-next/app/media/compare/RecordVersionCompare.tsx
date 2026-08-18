"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  createArchiveApiClient,
  deriveRecordSourcePath,
  type ArchiveRecord,
  type RecordAttachment
} from "@/lib/archive-api";
import { SyncPlaybackController } from "@/lib/media/sync-playback";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import ClipListPanel from "./ClipListPanel";
import styles from "./compare.module.css";

interface VersionOption {
  /** null identifies the record's primary source (no attachment row). */
  attachmentId: string | null;
  label: string;
  sourcePath: string;
  disk?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-enough-versions"; versions: VersionOption[] }
  | { status: "ready"; record: ArchiveRecord; versions: VersionOption[] };

const api = createArchiveApiClient();

function buildVersions(record: ArchiveRecord, attachments: RecordAttachment[]): VersionOption[] {
  const versions: VersionOption[] = [];
  const source = deriveRecordSourcePath(record);
  if (source) {
    versions.push({ attachmentId: null, label: record.title, sourcePath: source.sourcePath, disk: source.disk });
  }
  for (const attachment of attachments) {
    versions.push({ attachmentId: attachment.id, label: attachment.originalName, sourcePath: attachment.path, disk: attachment.disk });
  }
  return versions;
}

export default function RecordVersionCompare({ recordId, store }: Readonly<{ recordId: string; store: string }>) {
  const { t } = useLocale();
  const copy = t.pages.mediaCompare.versionCompare;
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [versionAKey, setVersionAKey] = useState<string>("");
  const [versionBKey, setVersionBKey] = useState<string>("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);

  const sync = useRef(new SyncPlaybackController());
  const elementA = useRef<HTMLMediaElement | null>(null);
  const elementB = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    sync.current.setEnabled(syncEnabled);
  }, [syncEnabled]);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    void (async () => {
      const recordResponse = await api.record(recordId);
      if (!active) return;
      if (!recordResponse.ok) {
        setState({ status: "error", message: recordResponse.error });
        return;
      }

      const attachmentsResponse = await api.recordAttachments(recordId, store);
      if (!active) return;
      const attachments = attachmentsResponse.ok ? attachmentsResponse.attachments : [];
      const versions = buildVersions(recordResponse.record, attachments);

      if (versions.length < 2) {
        setState({ status: "not-enough-versions", versions });
        return;
      }

      setVersionAKey(versions[0].attachmentId ?? versions[0].sourcePath);
      setVersionBKey(versions[1].attachmentId ?? versions[1].sourcePath);
      setState({ status: "ready", record: recordResponse.record, versions });
    })();

    return () => {
      active = false;
    };
  }, [recordId, store]);

  const versions = state.status === "ready" ? state.versions : [];
  const keyOf = (version: VersionOption) => version.attachmentId ?? version.sourcePath;
  const versionA = useMemo(() => versions.find((version) => keyOf(version) === versionAKey) ?? null, [versions, versionAKey]);
  const versionB = useMemo(() => versions.find((version) => keyOf(version) === versionBKey) ?? null, [versions, versionBKey]);

  function applyAction(side: "a" | "b", action: { type: "seek" | "play" | "pause"; time?: number }) {
    const element = side === "a" ? elementA.current : elementB.current;
    if (!element) return;
    sync.current.withGuard(() => {
      if (action.type === "seek" && typeof action.time === "number") {
        element.currentTime = action.time;
      } else if (action.type === "play") {
        void element.play().catch(() => undefined);
      } else if (action.type === "pause") {
        element.pause();
      }
    });
  }

  if (state.status === "loading") {
    return (
      <div className="panel">
        <Skeleton label={copy.loadingRecord} lines={4} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-banner state-banner-error" role="alert">
        <strong>{copy.loadError}</strong>
        <span className="helper-text">{state.message}</span>
      </div>
    );
  }

  if (state.status === "not-enough-versions") {
    return <EmptyState title={copy.notEnoughVersionsTitle} description={copy.notEnoughVersionsDescription} />;
  }

  return (
    <>
      <div className={`auth-form ${styles.pathInputForm}`}>
        <div className={`media-compare-grid ${styles.pathInputGrid}`}>
          <label>
            {copy.versionALabel}
            <select value={versionAKey} onChange={(event) => setVersionAKey(event.target.value)}>
              {versions.map((version) => (
                <option key={keyOf(version)} value={keyOf(version)}>
                  {version.attachmentId === null ? copy.primarySourceOption : version.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.versionBLabel}
            <select value={versionBKey} onChange={(event) => setVersionBKey(event.target.value)}>
              {versions.map((version) => (
                <option key={keyOf(version)} value={keyOf(version)}>
                  {version.attachmentId === null ? copy.primarySourceOption : version.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} />
          {t.pages.mediaCompare.syncLabel}
        </label>
      </div>

      <div className={`media-compare-grid ${styles.playersGrid}`}>
        <article className={`panel ${styles.playerPanel}`}>
          <div className={`panel-title-row ${styles.playerHeader}`}>
            <h2>{copy.versionALabel}</h2>
            <span className={`badge ${styles.sideBadge}`}>A</span>
          </div>
          {versionA ? (
            <MediaPlayer
              key={keyOf(versionA)}
              path={versionA.sourcePath}
              disk={versionA.disk}
              onReady={(element) => {
                elementA.current = element;
              }}
              onTimeUpdate={(element) => {
                setCurrentTimeA(element.currentTime);
                const action = sync.current.onTimeUpdate("a", element.currentTime, elementB.current?.currentTime ?? 0);
                if (action) applyAction("b", action);
              }}
              onPlayPause={(element) => {
                const action = sync.current.onPlayPause("a", element.paused);
                if (action) applyAction("b", action);
              }}
            />
          ) : null}
        </article>

        <article className={`panel ${styles.playerPanel}`}>
          <div className={`panel-title-row ${styles.playerHeader}`}>
            <h2>{copy.versionBLabel}</h2>
            <span className={`badge ${styles.sideBadge}`}>B</span>
          </div>
          {versionB ? (
            <MediaPlayer
              key={keyOf(versionB)}
              path={versionB.sourcePath}
              disk={versionB.disk}
              onReady={(element) => {
                elementB.current = element;
              }}
              onTimeUpdate={(element) => {
                setCurrentTimeB(element.currentTime);
                const action = sync.current.onTimeUpdate("b", element.currentTime, elementA.current?.currentTime ?? 0);
                if (action) applyAction("a", action);
              }}
              onPlayPause={(element) => {
                const action = sync.current.onPlayPause("b", element.paused);
                if (action) applyAction("a", action);
              }}
            />
          ) : null}
        </article>
      </div>

      {versionA && versionB ? (
        <ClipListPanel
          recordId={recordId}
          store={store}
          versionA={{ attachmentId: versionA.attachmentId, label: versionA.attachmentId === null ? copy.primarySourceOption : versionA.label }}
          versionB={{ attachmentId: versionB.attachmentId, label: versionB.attachmentId === null ? copy.primarySourceOption : versionB.label }}
          currentTimeA={currentTimeA}
          currentTimeB={currentTimeB}
        />
      ) : null}
    </>
  );
}
