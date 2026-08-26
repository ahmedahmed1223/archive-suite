"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import AsyncStateSurface from "@/components/AsyncStateSurface";
import PageToolbar from "@/components/PageToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createArchiveApiClient } from "@/lib/archive-api";
import { type EditorState } from "@/lib/montage-editor";
import MontageEditorPanel from "@/components/montage/MontageEditorPanel";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "ready"; state: EditorState };

export default function MontageEditorPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { t } = useLocale();
  const copy = t.pages.mediaStudio.montageEditor;
  const api = useMemo(() => createArchiveApiClient(), []);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  const loadData = useCallback(async () => {
    setLoad({ status: "loading" });
    const [projectRes, revRes] = await Promise.all([
      api.montageProject(projectId),
      api.montageActiveRevision(projectId),
    ]);

    if (!projectRes.ok) {
      setLoad(projectRes.error === "Forbidden." ? { status: "not-found" } : { status: "error", message: projectRes.error });
      return;
    }
    const project = projectRes as unknown as { revision: number };
    if (!revRes.ok) {
      // No revision yet — start from an empty timeline.
      setLoad({
        status: "ready",
        state: {
          projectId,
          revisionNumber: project.revision ?? 0,
          timeline: { tracks: [], clips: [] },
          past: [],
          future: [],
        },
      });
      return;
    }
    const rev = revRes as unknown as {
      revisionNumber: number;
      tracks: Array<{ id: string; kind: string; name?: string }>;
      clips: EditorState["timeline"]["clips"];
    };
    setLoad({
      status: "ready",
      state: {
        projectId,
        revisionNumber: rev.revisionNumber,
        timeline: {
          tracks: (rev.tracks as EditorState["timeline"]["tracks"]) ?? [],
          clips: (rev.clips as EditorState["timeline"]["clips"]) ?? [],
        },
        past: [],
        future: [],
      },
    });
  }, [api, projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const surfaceState =
    load.status === "loading"
      ? "loading"
      : load.status === "ready"
        ? "success"
        : "error";

  return (
    <AppShell subtitle={copy.panelAriaLabel}>
      <PageToolbar title={copy.panelAriaLabel} description={copy.exportTitle} />
      <AsyncStateSurface
        status={surfaceState}
        description={load.status === "error" ? load.message : undefined}
        onRetry={load.status !== "ready" ? () => void loadData() : undefined}
      >
        {load.status === "not-found" ? (
          <EmptyState title={copy.selectHint} description="" />
        ) : load.status === "ready" ? (
          <MontageEditorPanel
            projectId={projectId}
            initialState={load.state}
            materials={[]}
            copy={{
              ...copy,
              presenceLabel: copy.presenceLabel,
              noOtherEditors: copy.noOtherEditors,
            }}
          />
        ) : null}
      </AsyncStateSurface>
    </AppShell>
  );
}
