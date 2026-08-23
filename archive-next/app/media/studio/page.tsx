"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import AsyncStateSurface from "@/components/AsyncStateSurface";
import MediaPlayer from "@/components/MediaPlayer";
import MediaTechSpecCard, { computeMediaTechSpec, type MediaTechSpec } from "@/components/MediaTechSpecCard";
import PageToolbar from "@/components/PageToolbar";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  createArchiveApiClient,
  deriveRecordSourcePath,
  type ArchiveRecord,
  type RecordAttachment
} from "@/lib/archive-api";
import { isTypingTarget } from "@/lib/keyboard-shortcuts";
import { formatCueTime, getActiveCue, parseSubtitles } from "@/lib/media/subtitles";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import MediaDerivativesTree from "../../archive/[id]/MediaDerivativesTree";
import StudioCommentsPanel from "./StudioCommentsPanel";
import styles from "./studio.module.css";
import "../media.css";

// V3-PERF-004: the timeline panel is a secondary side-column panel (realtime
// comments + markers over the Echo/Reverb client) that isn't needed for the
// primary player/transcript to become interactive, so it's split into its
// own chunk and streamed in after the main studio UI.
const StudioTimelinePanel = dynamic(() => import("./StudioTimelinePanel"), {
  ssr: false,
  loading: () => (
    <div className="panel">
      <Skeleton variant="block" lines={3} />
    </div>
  )
});

const EMPTY_TECH_SPEC: MediaTechSpec = {
  widthPx: null,
  heightPx: null,
  aspectRatio: null,
  durationSeconds: null,
  estimatedBitrateBps: null
};

type StudioState =
  | { status: "invalid" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "attachment-not-found" }
  | {
      status: "ready";
      record: ArchiveRecord;
      attachment: RecordAttachment | null;
      sourcePath: { sourcePath: string; disk?: string } | null;
    };

/**
 * Keyboard shortcuts must never steal a keystroke from a text field, and must
 * not eat the native Space-activates-button/link behavior either -- so any
 * focused interactive control opts out, not just typing surfaces.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (isTypingTarget(target)) return true;
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "BUTTON" || target.tagName === "A" || target.tagName === "SELECT";
}

function ComingSoonPanel({ title, heading, description }: Readonly<{ title: string; heading: string; description: string }>) {
  return (
    <article className="panel" aria-label={title}>
      <h2>{title}</h2>
      <EmptyState title={heading} description={description} />
    </article>
  );
}

export default function MediaStudioPage() {
  const { t } = useLocale();
  const copy: AppDictionary["pages"]["mediaStudio"] = t.pages.mediaStudio;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<StudioState>({ status: "loading" });
  const [mediaElement, setMediaElement] = useState<HTMLMediaElement | null>(null);
  const [techSpec, setTechSpec] = useState<MediaTechSpec>(EMPTY_TECH_SPEC);
  const [currentTime, setCurrentTime] = useState(0);

  // V14-UX-006 (Task 6): loading extracted so the error state's retry button
  // can re-run the exact same operation.
  const loadStudio = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get("recordId")?.trim() ?? "";
    const attachmentId = params.get("attachmentId")?.trim() ?? "";

    if (!recordId) {
      setState({ status: "invalid" });
      return;
    }

    setState({ status: "loading" });

    const recordResponse = await api.record(recordId);
    if (!recordResponse.ok) {
      setState({ status: "error", message: recordResponse.error });
      return;
    }

    const record = recordResponse.record;
    const sourcePath = deriveRecordSourcePath(record);

    if (!attachmentId) {
      setState({ status: "ready", record, attachment: null, sourcePath });
      return;
    }

    const attachmentsResponse = await api.recordAttachments(recordId, record.store || "archive-items");
    if (!attachmentsResponse.ok) {
      setState({ status: "error", message: attachmentsResponse.error });
      return;
    }

    const attachment = attachmentsResponse.attachments.find((item) => item.id === attachmentId) ?? null;
    if (!attachment) {
      setState({ status: "attachment-not-found" });
      return;
    }

    setState({ status: "ready", record, attachment, sourcePath });
  }, [api]);

  useEffect(() => {
    void loadStudio();
  }, [loadStudio]);

  const attachmentSizeBytes = state.status === "ready" ? state.attachment?.sizeBytes ?? null : null;

  useEffect(() => {
    if (!mediaElement) return;

    const updateSpec = () => setTechSpec(computeMediaTechSpec(mediaElement, attachmentSizeBytes));
    if (mediaElement.readyState >= 1) updateSpec();
    mediaElement.addEventListener("loadedmetadata", updateSpec);
    return () => mediaElement.removeEventListener("loadedmetadata", updateSpec);
  }, [mediaElement, attachmentSizeBytes]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!mediaElement) return;
      mediaElement.currentTime = Math.max(0, seconds);
      setCurrentTime(mediaElement.currentTime);
    },
    [mediaElement]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target) || !mediaElement) return;

      if (event.key === " ") {
        event.preventDefault();
        if (mediaElement.paused) void mediaElement.play();
        else mediaElement.pause();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(mediaElement.currentTime - 5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(Math.min(mediaElement.duration || Infinity, mediaElement.currentTime + 5));
      }
    },
    [mediaElement, seekTo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const transcriptText = state.status === "ready" ? state.record.transcript ?? "" : "";
  const cues = useMemo(() => parseSubtitles(transcriptText), [transcriptText]);
  const activeCue = useMemo(() => getActiveCue(cues, currentTime), [cues, currentTime]);

  return (
    <AppShell subtitle={t.pageTitles.mediaStudio} contentClassName={styles.studioContent}>
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        actions={<a className="button button-secondary" href="/media/jobs">{copy.openMediaJobs}</a>}
        meta={
          state.status === "ready" ? (
            <>
              <span className="badge">
                {copy.recordLabel}: {state.record.title}
              </span>
              {state.attachment ? (
                <span className="badge">
                  {copy.attachmentLabel}: {state.attachment.originalName}
                </span>
              ) : null}
            </>
          ) : null
        }
      />

      {state.status === "invalid" ? (
        <EmptyState
          title={copy.missingRecordTitle}
          description={copy.missingRecordDescription}
          actions={<a className="button button-primary" href="/archive">{copy.browseArchive}</a>}
        />
      ) : null}

      {state.status === "loading" || state.status === "error" ? (
        /* V14-UX-006: shared semantic state surface with retry. */
        <AsyncStateSurface
          status={state.status === "loading" ? "loading" : "error"}
          loadingLabel={copy.loadingRecord}
          title={state.status === "error" ? copy.loadErrorTitle : undefined}
          description={state.status === "error" ? state.message : undefined}
          onRetry={state.status === "error" ? () => void loadStudio() : undefined}
        />
      ) : null}

      {state.status === "attachment-not-found" ? (
        <EmptyState title={copy.attachmentNotFoundTitle} description={copy.attachmentNotFoundDescription} />
      ) : null}

      {state.status === "ready" ? (
        <>
          <p className={`helper-text ${styles.mobileNotice}`}>{copy.mobileNotice}</p>

          <div className={styles.studioGrid}>
            <div className={styles.playerColumn}>
              <article className={`panel media-frame ${styles.playerPanel}`}>
                {state.sourcePath ? (
                  <>
                    <MediaPlayer
                      path={state.sourcePath.sourcePath}
                      disk={state.sourcePath.disk}
                      title={state.record.title}
                      showTimeline
                      showTranscriptList={false}
                      transcriptText={transcriptText}
                      onReady={setMediaElement}
                      onTimeUpdate={(element) => setCurrentTime(element.currentTime)}
                    />
                    <p className={`helper-text ${styles.shortcutsHint}`}>{copy.shortcutsHint}</p>
                  </>
                ) : (
                  <EmptyState title={copy.noSourceTitle} description={copy.noSourceDescription} />
                )}
              </article>

              <MediaTechSpecCard spec={techSpec} />

              <article className="panel" aria-label={copy.transcript.title}>
                <h2>{copy.transcript.title}</h2>
                {cues.length ? (
                  <ol className="media-player__transcript" aria-label={copy.transcript.ariaLabel}>
                    {cues.map((cue) => (
                      <li key={cue.index}>
                        <button
                          type="button"
                          className={activeCue?.index === cue.index ? "is-active" : undefined}
                          onClick={() => seekTo(cue.start)}
                        >
                          <span dir="ltr">{formatCueTime(cue.start)}</span>
                          <span dir="auto">{cue.text}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="helper-text">{copy.transcript.empty}</p>
                )}
              </article>
            </div>

            <div className={styles.sideColumn}>
              <StudioCommentsPanel recordId={state.record.id} store={state.record.store || "archive-items"} />

              <div className={styles.advancedPanels}>
                <MediaDerivativesTree record={state.record} />
                <StudioTimelinePanel
                  recordId={state.record.id}
                  store={state.record.store || "archive-items"}
                  attachmentId={state.attachment?.id ?? null}
                  durationSeconds={techSpec.durationSeconds}
                  currentTime={currentTime}
                  onSeek={seekTo}
                />
                <ComingSoonPanel title={copy.tasks.title} heading={copy.tasks.comingSoonTitle} description={copy.tasks.comingSoonDescription} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
