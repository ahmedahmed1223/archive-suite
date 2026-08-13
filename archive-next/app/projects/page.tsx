"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, deriveRecordSourcePath, type ArchiveRecord, type MediaJob } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import {
  addClip,
  buildEdl,
  buildFcpXml,
  buildPremiereXml,
  buildTimelineJson,
  clipDuration,
  createProject,
  deleteProject,
  isValidClip,
  listProjects,
  orderedClips,
  projectDuration,
  removeClip,
  reorderClip,
  resolveMontageClipPaths,
  safeFileName,
  saveProject,
  secondsToTimecode,
  updateClip,
  type MontageClip,
  type MontageProject
} from "@/lib/montage";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${mm}:${p2(ss)}`;
}

function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

export default function ProjectsPage() {
  const { t } = useLocale();
  const copy = t.pages.projects;
  const dialogs = useConfirmDialog();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [projects, setProjects] = useState<MontageProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [exportJob, setExportJob] = useState<MediaJob | null>(null);
  const [exportError, setExportError] = useState("");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ArchiveRecord[]>([]);
  const [searchError, setSearchError] = useState("");
  const [inSec, setInSec] = useState("0");
  const [outSec, setOutSec] = useState("10");

  useEffect(() => {
    void (async () => {
      const stored = await listProjects();
      setProjects(stored);
      setSelectedId(stored[0]?.id || null);
    })();
  }, []);

  const selected = projects.find((project) => project.id === selectedId) || null;
  const clips = selected ? orderedClips(selected) : [];
  const validCount = clips.filter(isValidClip).length;

  function persist(project: MontageProject) {
    void (async () => {
      const updated = await saveProject(project);
      setProjects(Array.isArray(updated) ? updated : [updated]);
    })();
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const project = createProject(name);
    void (async () => {
      const updated = await saveProject(project);
      setProjects(Array.isArray(updated) ? updated : [updated]);
      setSelectedId(project.id);
      setNewName("");
      setFeedback(copy.feedback.projectCreated.replace("{name}", project.name));
    })();
  }

  async function handleDelete(project: MontageProject) {
    const confirmed = await dialogs.confirm({
      title: copy.dialogs.deleteProjectTitle,
      message: copy.dialogs.deleteProjectMessage.replace("{name}", project.name),
      confirmLabel: copy.dialogs.deleteConfirm,
      destructive: true
    });
    if (!confirmed) return;
    await deleteProject(project.id);
    const next = await listProjects();
    setProjects(next);
    if (selectedId === project.id) setSelectedId(next[0]?.id || null);
    setFeedback(copy.feedback.projectDeleted.replace("{name}", project.name));
  }

  async function handleSearch() {
    setSearching(true);
    setSearchError("");
    const response = await api.search({ q: query.trim() || undefined, limit: 50 });
    if (response.ok) {
      setResults(response.records);
      if (response.records.length === 0) setSearchError(copy.clipSearch.noResults);
    } else {
      setResults([]);
      setSearchError(response.error);
    }
    setSearching(false);
  }

  function handleAddClip(record: ArchiveRecord) {
    if (!selected) return;
    const start = Number(inSec);
    const end = Number(outSec);
    if (!(end > start)) {
      setFeedback(copy.feedback.invalidRange);
      return;
    }
    const videoTrack = selected.tracks.find((t) => t.type === "video");
    const trackId = videoTrack?.id || selected.tracks[0]?.id || "";
    persist(addClip(selected, {
      itemId: record.id,
      title: record.title || record.id,
      trackId,
      inSec: start,
      outSec: end
    }));
    setFeedback(copy.feedback.clipAdded.replace("{title}", record.title || record.id));
  }

  async function handleRemoveClip(clip: MontageClip) {
    if (!selected) return;
    const confirmed = await dialogs.confirm({
      title: copy.dialogs.deleteClipTitle,
      message: copy.dialogs.deleteClipMessage.replace("{title}", clip.title || clip.itemId),
      confirmLabel: copy.dialogs.deleteConfirm,
      destructive: true
    });
    if (!confirmed) return;
    persist(removeClip(selected, clip.id));
  }

  useEffect(() => {
    if (!exportJob || exportJob.status === "completed" || exportJob.status === "failed") return;

    const timer = setInterval(() => {
      void (async () => {
        const response = await api.mediaJob(exportJob.id);
        if (response.ok) setExportJob(response.job);
      })();
    }, 2000);

    return () => clearInterval(timer);
  }, [api, exportJob]);

  async function handleExportMp4() {
    if (!selected) return;
    const validClips = orderedClips(selected).filter(isValidClip);
    if (validClips.length === 0) return;

    setExportError("");

    // Resolve each clip's record ID to its real stored file path before
    // submitting the job — ffmpeg needs a filesystem path, not a record ID.
    const uniqueItemIds = Array.from(new Set(validClips.map((clip: MontageClip) => clip.itemId)));
    const sourceByItemId = new Map<string, { sourcePath: string; disk?: string } | null>();
    for (const itemId of uniqueItemIds) {
      const response = await api.record(itemId);
      const source = response.ok && response.record ? deriveRecordSourcePath(response.record as ArchiveRecord) : null;
      sourceByItemId.set(itemId, source);
    }

    const { clips, failures } = resolveMontageClipPaths(
      validClips,
      (itemId) => sourceByItemId.get(itemId) ?? null
    );

    if (failures.length > 0) {
      const titles = failures.map((failure) => failure.clip.title || failure.clip.itemId).join("، ");
      setExportError(copy.export.pathResolutionError.replace("{titles}", titles));
      return;
    }

    const response = await api.createMediaJob({
      recordId: selected.id,
      operation: "montage_export",
      options: { clips },
    });

    if (response.ok) {
      setExportJob(response.job);
      setFeedback(copy.feedback.exportMp4Queued);
    } else {
      setExportError(response.error);
    }
  }

  function handleExport(kind: "json" | "edl" | "premiere" | "fcpxml") {
    if (!selected) return;
    const base = safeFileName(selected.name);
    const formats = {
      json: {
        content: () => JSON.stringify(buildTimelineJson(selected), null, 2),
        filename: `${base}.timeline.json`,
        type: "application/json",
        message: copy.feedback.exportJson
      },
      edl: {
        content: () => buildEdl(selected),
        filename: `${base}.edl`,
        type: "text/plain",
        message: copy.feedback.exportEdl
      },
      premiere: {
        content: () => buildPremiereXml(selected),
        filename: `${base}.xml`,
        type: "application/xml",
        message: copy.feedback.exportPremiere
      },
      fcpxml: {
        content: () => buildFcpXml(selected),
        filename: `${base}.fcpxml`,
        type: "application/xml",
        message: copy.feedback.exportFcpXml
      }
    } as const;
    const format = formats[kind];
    downloadText(format.content(), format.filename, format.type);
    setFeedback(format.message);
  }

  return (
    <AppShell subtitle={t.pageTitles.projects} contentClassName="local-list-content" tipsPage="projects">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={(
          <>
            <span className="badge">{copy.toolbar.projectCount.replace("{count}", String(projects.length))}</span>
            {selected ? <span className="badge">{copy.toolbar.clipCount.replace("{count}", String(clips.length))}</span> : null}
            {selected ? <span className="badge">{copy.toolbar.duration.replace("{duration}", formatClock(projectDuration(selected)))}</span> : null}
          </>
        )}
        actions={<><a className="button button-secondary" href="/project-groups">{copy.toolbar.workProjects}</a><a className="button button-secondary" href="/archive">{copy.toolbar.openArchive}</a></>}
      />

      {feedback ? (
        <div className="state-banner" role="status">
          <strong>{copy.feedback.title}</strong>
          <span className="helper-text">{feedback}</span>
        </div>
      ) : null}
      <ChangeImpactPreview impact={buildChangeImpact({ action: "update", entity: copy.changeImpactEntity, affectedCount: 0 })} />

      <section className="panel panel-compact" aria-label={copy.projectsList.ariaLabel}>
        <div className="panel-title-row">
          <h2>{copy.projectsList.title}</h2>
          <span className="badge">{projects.length}</span>
        </div>
        <div className="button-row">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") handleCreate(); }}
            placeholder={copy.projectsList.newNamePlaceholder}
            aria-label={copy.projectsList.newNameAriaLabel}
          />
          <button type="button" className="button" onClick={handleCreate} disabled={!newName.trim()}>
            {copy.projectsList.create}
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="helper-text">{copy.projectsList.empty}</p>
        ) : (
          <div className="button-row" role="list" aria-label={copy.projectsList.savedAriaLabel}>
            {projects.map((project) => (
              <div key={project.id} role="listitem" className="button-row">
                <button
                  type="button"
                  className={project.id === selectedId ? "button" : "button button-secondary"}
                  aria-pressed={project.id === selectedId}
                  onClick={() => setSelectedId(project.id)}
                >
                  {project.name} ({project.clips.length})
                </button>
                <button type="button" className="button button-secondary button-sm" onClick={() => handleDelete(project)}>
                  {copy.projectsList.delete}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!selected ? (
        <EmptyState title={copy.projectsList.noSelectionTitle} description={copy.projectsList.noSelectionDescription} />
      ) : (
        <>
          <section className="panel panel-compact" aria-label={copy.clipSearch.ariaLabel}>
            <div className="panel-title-row">
              <h2>{copy.clipSearch.title}</h2>
              <span className="badge">{copy.clipSearch.resultsCount.replace("{count}", String(results.length))}</span>
            </div>
            <div className="button-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void handleSearch(); }}
                placeholder={copy.clipSearch.searchPlaceholder}
                aria-label={copy.clipSearch.searchAriaLabel}
              />
              <label className="helper-text">
                {copy.clipSearch.inLabel}
                <input type="number" min="0" step="0.1" value={inSec} onChange={(event) => setInSec(event.target.value)} aria-label={copy.clipSearch.inAriaLabel} />
              </label>
              <label className="helper-text">
                {copy.clipSearch.outLabel}
                <input type="number" min="0" step="0.1" value={outSec} onChange={(event) => setOutSec(event.target.value)} aria-label={copy.clipSearch.outAriaLabel} />
              </label>
              <button type="button" className="button" onClick={() => void handleSearch()} disabled={searching}>
                {searching ? copy.clipSearch.searching : copy.clipSearch.search}
              </button>
            </div>
            {searchError ? <p className="helper-text">{searchError}</p> : null}
            {results.slice(0, 20).map((record) => (
              <div className="kanban-card" key={record.id}>
                <strong>{record.title || record.id}</strong>
                <span className="helper-text">{record.type || copy.clipSearch.unspecified}</span>
                <div className="button-row">
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleAddClip(record)}>
                    {copy.clipSearch.add}
                  </button>
                  <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>{copy.clipSearch.open}</a>
                </div>
              </div>
            ))}
          </section>

          <section className="panel panel-compact" aria-label={copy.timeline.ariaLabel}>
            <div className="panel-title-row">
              <h2>{copy.timeline.title.replace("{name}", selected.name)}</h2>
              <span className="badge">{formatClock(projectDuration(selected))}</span>
            </div>
            {clips.length === 0 ? (
              <p className="helper-text">{copy.timeline.empty}</p>
            ) : (
              clips.map((clip: MontageClip, index: number) => (
                <div className="kanban-card" key={clip.id}>
                  <strong>{index + 1}. {clip.title || clip.itemId}</strong>
                  <span className="helper-text" dir="ltr">
                    {secondsToTimecode(clip.inSec, selected.fps)} → {secondsToTimecode(clip.outSec, selected.fps)} ({formatClock(clipDuration(clip))})
                    {isValidClip(clip) ? "" : copy.timeline.invalidPoints}
                  </span>
                  <div className="button-row">
                    <label className="helper-text">
                      {copy.timeline.inLabel}
                      <input
                        type="number" min="0" step="0.1" value={clip.inSec}
                        onChange={(event) => persist(updateClip(selected, clip.id, { inSec: Number(event.target.value) }))}
                        aria-label={copy.timeline.inAriaLabel.replace("{title}", clip.title || clip.itemId)}
                      />
                    </label>
                    <label className="helper-text">
                      {copy.timeline.outLabel}
                      <input
                        type="number" min="0" step="0.1" value={clip.outSec}
                        onChange={(event) => persist(updateClip(selected, clip.id, { outSec: Number(event.target.value) }))}
                        aria-label={copy.timeline.outAriaLabel.replace("{title}", clip.title || clip.itemId)}
                      />
                    </label>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => persist(reorderClip(selected, clip.id, index - 1))}
                      disabled={index === 0}
                      aria-label={copy.timeline.moveUpAriaLabel.replace("{title}", clip.title || clip.itemId)}
                    >
                      ▲
                    </button>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => persist(reorderClip(selected, clip.id, index + 1))}
                      disabled={index === clips.length - 1}
                      aria-label={copy.timeline.moveDownAriaLabel.replace("{title}", clip.title || clip.itemId)}
                    >
                      ▼
                    </button>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => handleRemoveClip(clip)}
                    >
                      {copy.timeline.delete}
                    </button>
                    <span className="helper-text">{copy.timeline.deleteNote}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel panel-compact" aria-label={copy.export.ariaLabel}>
            <div className="panel-title-row">
              <h2>{copy.export.title}</h2>
              <span className="badge">{copy.export.validCount.replace("{count}", String(validCount))}</span>
            </div>
            <div className="button-row">
              <button type="button" className="button" onClick={() => handleExport("json")} disabled={validCount === 0}>
                {copy.export.json}
              </button>
              <button type="button" className="button" onClick={() => handleExport("edl")} disabled={validCount === 0}>
                {copy.export.edl}
              </button>
              <button type="button" className="button" onClick={() => handleExport("premiere")} disabled={validCount === 0}>
                {copy.export.premiere}
              </button>
              <button type="button" className="button" onClick={() => handleExport("fcpxml")} disabled={validCount === 0}>
                {copy.export.fcpXml}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void handleExportMp4()}
                disabled={validCount === 0 || (exportJob !== null && exportJob.status !== "completed" && exportJob.status !== "failed")}
              >
                {copy.export.mp4}
              </button>
            </div>
            <p className="helper-text">
              {copy.export.mp4Hint}
            </p>
            {exportError ? <p className="form-status status-error" role="alert">{exportError}</p> : null}
            {exportJob ? (
              <div className="state-banner" role="status">
                <strong>{copy.export.status.replace("{status}", exportJob.status)}</strong>
                {exportJob.status === "completed" && exportJob.result?.artifacts ? (
                  <a
                    className="button button-secondary button-sm"
                    href={`/api/v1/files/stream?path=${encodeURIComponent(
                      (exportJob.result.artifacts as Array<{ key: string }>)[0]?.key || ""
                    )}`}
                  >
                    {copy.export.download}
                  </a>
                ) : exportJob.status === "failed" ? (
                  <span className="helper-text">{copy.export.failed.replace("{error}", exportJob.error || "")}</span>
                ) : (
                  <span className="helper-text">{copy.export.running}</span>
                )}
              </div>
            ) : null}
          </section>
        </>
      )}
    </AppShell>
  );
}
