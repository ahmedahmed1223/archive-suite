"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type ShareState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; permission?: string }
  | { status: "error"; message: string };

export function ShareViewer({ token }: { token: string }) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.share(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({
        status: "ready",
        records: response.records,
        permission: typeof response.permission === "string" ? response.permission : undefined
      });
    });

    return () => {
      active = false;
    };
  }, [api, token]);

  if (state.status === "loading") {
    return <p className="form-status">جار تحميل محتوى المشاركة...</p>;
  }

  if (state.status === "error") {
    return <p className="form-status" role="alert">{state.message}</p>;
  }

  return (
    <div className="share-list" aria-label="محتوى المشاركة">
      <p className="form-status">صلاحية المشاركة: {state.permission ?? "view"}</p>
      {state.records.length === 0 ? (
        <p className="form-status">لا توجد سجلات في هذه المشاركة.</p>
      ) : (
        state.records.map((record) => (
          <article className="panel" key={record.uid ?? record.id}>
            <h2>{record.title}</h2>
            {record.description ? <p>{record.description}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
