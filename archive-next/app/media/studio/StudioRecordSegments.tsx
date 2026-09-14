"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Scissors } from "lucide-react";
import { createArchiveApiClient, type RecordSegment } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCueTime } from "@/lib/media/subtitles";

type State =
  | { status: "loading" }
  | { status: "ready"; segments: RecordSegment[] }
  | { status: "error"; message: string };

function segmentStart(segment: RecordSegment): number | null {
  return typeof segment.startSeconds === "number" ? segment.startSeconds : null;
}

export default function StudioRecordSegments({ recordId, onSeek }: Readonly<{ recordId: string; onSeek: (seconds: number) => void }>) {
  const { t } = useLocale();
  const copy = t.pages.mediaStudio.segments;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.recordSegments(recordId);
    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }
    setState({
      status: "ready",
      segments: [...response.segments].sort((left, right) => (segmentStart(left) ?? Number.POSITIVE_INFINITY) - (segmentStart(right) ?? Number.POSITIVE_INFINITY))
    });
  }, [api, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <article className="panel" aria-labelledby="studio-segments-title">
      <div className="panel-title-row">
        <div>
          <h2 id="studio-segments-title">{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <Scissors size={20} aria-hidden="true" />
      </div>
      {state.status === "loading" ? <p className="helper-text" role="status">{copy.loading}</p> : null}
      {state.status === "error" ? <p className="form-status status-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{copy.error.replace("{message}", state.message)}</p> : null}
      {state.status === "ready" && state.segments.length === 0 ? <p className="helper-text">{copy.empty}</p> : null}
      {state.status === "ready" && state.segments.length > 0 ? (
        <ol className="compact-list">
          {state.segments.map((segment) => {
            const start = segmentStart(segment);
            const end = typeof segment.endSeconds === "number" ? segment.endSeconds : null;
            const range = start === null ? copy.unbounded : end === null ? formatCueTime(start) : `${formatCueTime(start)} — ${formatCueTime(end)}`;
            const jumpLabel = start === null ? null : copy.jumpAriaLabel.replace("{title}", segment.title).replace("{time}", formatCueTime(start));
            return (
              <li key={segment.id}>
                <div>
                  <strong>{segment.title}</strong>
                  <span dir="ltr" className="helper-text">{range}</span>
                </div>
                {start === null ? null : <button type="button" className="button button-secondary button-sm" aria-label={jumpLabel ?? undefined} onClick={() => onSeek(start)}>{copy.jump}</button>}
              </li>
            );
          })}
        </ol>
      ) : null}
    </article>
  );
}
