"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord, type MediaJob } from "@/lib/archive-api";
import {
  addClip,
  buildEdl,
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
  safeFileName,
  saveProject,
  secondsToTimecode,
  updateClip,
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
    const stored = listProjects();
    setProjects(stored);
    setSelectedId(stored[0]?.id || null);
  }, []);

  const selected = projects.find((project) => project.id === selectedId) || null;
  const clips = selected ? orderedClips(selected) : [];
  const validCount = clips.filter(isValidClip).length;

  function persist(project: MontageProject) {
    setProjects(saveProject(project));
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const project = createProject(name);
    setProjects(saveProject(project));
    setSelectedId(project.id);
    setNewName("");
    setFeedback(`تم إنشاء المشروع "${project.name}"`);
  }

  function handleDelete(project: MontageProject) {
    if (!window.confirm(`حذف المشروع "${project.name}"؟`)) return;
    const next = deleteProject(project.id);
    setProjects(next);
    if (selectedId === project.id) setSelectedId(next[0]?.id || null);
    setFeedback(`تم حذف المشروع "${project.name}"`);
  }

  async function handleSearch() {
    setSearching(true);
    setSearchError("");
    const response = await api.search({ q: query.trim() || undefined, limit: 50 });
    if (response.ok) {
      setResults(response.records);
      if (response.records.length === 0) setSearchError("لا توجد سجلات مطابقة.");
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
      setFeedback("نقطة النهاية يجب أن تكون بعد نقطة البداية.");
      return;
    }
    persist(addClip(selected, {
      itemId: record.id,
      title: record.title || record.id,
      inSec: start,
      outSec: end
    }));
    setFeedback(`تمت إضافة "${record.title || record.id}" إلى الخط الزمني`);
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
    const response = await api.createMediaJob({
      recordId: selected.id,
      operation: "montage_export",
      options: {
        clips: validClips.map((clip) => ({
          path: clip.itemId,
          inSec: clip.inSec,
          outSec: clip.outSec,
        })),
      },
    });

    if (response.ok) {
      setExportJob(response.job);
      setFeedback("تم إرسال مهمة تصدير MP4، جارٍ المعالجة في الخلفية.");
    } else {
      setExportError(response.error);
    }
  }

  function handleExport(kind: "json" | "edl") {
    if (!selected) return;
    const base = safeFileName(selected.name);
    if (kind === "json") {
      downloadText(JSON.stringify(buildTimelineJson(selected), null, 2), `${base}.timeline.json`, "application/json");
    } else {
      downloadText(buildEdl(selected), `${base}.edl`, "text/plain");
    }
    setFeedback(kind === "json" ? "تم تنزيل ملف JSON للخط الزمني" : "تم تنزيل ملف EDL (CMX3600)");
  }

  return (
    <AppShell subtitle="المشاريع" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Montage</span>}
        title="المشاريع / المونتاج"
        description="تجميع قصاصات من مواد الأرشيف على خط زمني، مع ترتيب ونقاط دخول/خروج وتصدير JSON أو EDL."
        meta={(
          <>
            <span className="badge">{projects.length} مشروع</span>
            {selected ? <span className="badge">{clips.length} قصاصة</span> : null}
            {selected ? <span className="badge">المدة {formatClock(projectDuration(selected))}</span> : null}
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">فتح الأرشيف</a>}
      />

      {feedback ? (
        <div className="state-banner" role="status">
          <strong>المشاريع</strong>
          <span className="helper-text">{feedback}</span>
        </div>
      ) : null}

      <section className="panel panel-compact" aria-label="قائمة المشاريع">
        <div className="panel-title-row">
          <h2>المشاريع</h2>
          <span className="badge">{projects.length}</span>
        </div>
        <div className="button-row">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") handleCreate(); }}
            placeholder="اسم مشروع جديد..."
            aria-label="اسم مشروع جديد"
          />
          <button type="button" className="button" onClick={handleCreate} disabled={!newName.trim()}>
            إنشاء مشروع
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="helper-text">لا توجد مشاريع بعد. أنشئ مشروعًا لبدء تجميع القصاصات. تُحفظ المشاريع محليًا في هذا المتصفح.</p>
        ) : (
          <div className="button-row" role="list" aria-label="المشاريع المحفوظة">
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
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!selected ? (
        <EmptyState title="لا يوجد مشروع محدد." description="أنشئ مشروعًا أو اختر واحدًا من القائمة لفتح محرر الخط الزمني." />
      ) : (
        <>
          <section className="panel panel-compact" aria-label="إضافة قصاصات من الأرشيف">
            <div className="panel-title-row">
              <h2>إضافة قصاصة من الأرشيف</h2>
              <span className="badge">{results.length} نتيجة</span>
            </div>
            <div className="button-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void handleSearch(); }}
                placeholder="بحث في سجلات الأرشيف..."
                aria-label="بحث في سجلات الأرشيف"
              />
              <label className="helper-text">
                بداية (ث)
                <input type="number" min="0" step="0.1" value={inSec} onChange={(event) => setInSec(event.target.value)} aria-label="نقطة البداية بالثواني" />
              </label>
              <label className="helper-text">
                نهاية (ث)
                <input type="number" min="0" step="0.1" value={outSec} onChange={(event) => setOutSec(event.target.value)} aria-label="نقطة النهاية بالثواني" />
              </label>
              <button type="button" className="button" onClick={() => void handleSearch()} disabled={searching}>
                {searching ? "جار البحث..." : "بحث"}
              </button>
            </div>
            {searchError ? <p className="helper-text">{searchError}</p> : null}
            {results.slice(0, 20).map((record) => (
              <div className="kanban-card" key={record.id}>
                <strong>{record.title || record.id}</strong>
                <span className="helper-text">{record.type || "غير محدد"}</span>
                <div className="button-row">
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleAddClip(record)}>
                    إضافة للخط الزمني
                  </button>
                  <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>فتح</a>
                </div>
              </div>
            ))}
          </section>

          <section className="panel panel-compact" aria-label="الخط الزمني للمشروع">
            <div className="panel-title-row">
              <h2>الخط الزمني — {selected.name}</h2>
              <span className="badge">{formatClock(projectDuration(selected))}</span>
            </div>
            {clips.length === 0 ? (
              <p className="helper-text">لا توجد قصاصات بعد. ابحث في الأرشيف أعلاه وأضف قصاصات إلى الخط الزمني.</p>
            ) : (
              clips.map((clip, index) => (
                <div className="kanban-card" key={clip.id}>
                  <strong>{index + 1}. {clip.title || clip.itemId}</strong>
                  <span className="helper-text" dir="ltr">
                    {secondsToTimecode(clip.inSec, selected.fps)} → {secondsToTimecode(clip.outSec, selected.fps)} ({formatClock(clipDuration(clip))})
                    {isValidClip(clip) ? "" : " — نقاط غير صالحة"}
                  </span>
                  <div className="button-row">
                    <label className="helper-text">
                      بداية
                      <input
                        type="number" min="0" step="0.1" value={clip.inSec}
                        onChange={(event) => persist(updateClip(selected, clip.id, { inSec: Number(event.target.value) }))}
                        aria-label={`نقطة بداية ${clip.title}`}
                      />
                    </label>
                    <label className="helper-text">
                      نهاية
                      <input
                        type="number" min="0" step="0.1" value={clip.outSec}
                        onChange={(event) => persist(updateClip(selected, clip.id, { outSec: Number(event.target.value) }))}
                        aria-label={`نقطة نهاية ${clip.title}`}
                      />
                    </label>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => persist(reorderClip(selected, clip.id, index - 1))}
                      disabled={index === 0}
                      aria-label={`تحريك ${clip.title} لأعلى`}
                    >
                      ▲
                    </button>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => persist(reorderClip(selected, clip.id, index + 1))}
                      disabled={index === clips.length - 1}
                      aria-label={`تحريك ${clip.title} لأسفل`}
                    >
                      ▼
                    </button>
                    <button
                      type="button" className="button button-secondary button-sm"
                      onClick={() => persist(removeClip(selected, clip.id))}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel panel-compact" aria-label="تصدير المشروع">
            <div className="panel-title-row">
              <h2>التصدير</h2>
              <span className="badge">{validCount} قصاصة صالحة</span>
            </div>
            <div className="button-row">
              <button type="button" className="button" onClick={() => handleExport("json")} disabled={validCount === 0}>
                تصدير JSON
              </button>
              <button type="button" className="button" onClick={() => handleExport("edl")} disabled={validCount === 0}>
                تصدير EDL
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void handleExportMp4()}
                disabled={validCount === 0 || (exportJob !== null && exportJob.status !== "completed" && exportJob.status !== "failed")}
              >
                تصدير MP4
              </button>
            </div>
            <p className="helper-text">
              تصدير MP4 يعمل كمهمة Laravel غير متزامنة (montage_export) تجمع القصاصات عبر ffmpeg في الخلفية دون حجب الطلب.
            </p>
            {exportError ? <p className="form-status status-error" role="alert">{exportError}</p> : null}
            {exportJob ? (
              <div className="state-banner" role="status">
                <strong>حالة تصدير MP4: {exportJob.status}</strong>
                {exportJob.status === "completed" && exportJob.result?.artifacts ? (
                  <a
                    className="button button-secondary button-sm"
                    href={`/api/v1/files/stream?path=${encodeURIComponent(
                      (exportJob.result.artifacts as Array<{ key: string }>)[0]?.key || ""
                    )}`}
                  >
                    تنزيل ملف MP4
                  </a>
                ) : exportJob.status === "failed" ? (
                  <span className="helper-text">فشل التصدير: {exportJob.error}</span>
                ) : (
                  <span className="helper-text">جارٍ التنفيذ في الخلفية...</span>
                )}
              </div>
            ) : null}
          </section>
        </>
      )}
    </AppShell>
  );
}
