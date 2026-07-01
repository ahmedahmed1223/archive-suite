"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ReviewLinkDetails } from "@/lib/archive-api";

type ReviewLinkState =
  | { status: "loading" }
  | { status: "ready"; data: ReviewLinkDetails }
  | { status: "error"; message: string };

export function ReviewLinkViewer({ token }: { token: string }) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ReviewLinkState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.reviewLink(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({ status: "ready", data: response });
    });

    return () => {
      active = false;
    };
  }, [api, token]);

  if (state.status === "loading") {
    return <p className="form-status">جار تحميل رابط المراجعة...</p>;
  }

  if (state.status === "error") {
    return <p className="form-status" role="alert">{state.message}</p>;
  }

  const { data } = state;

  return (
    <div className="share-list" aria-label="محتوى رابط المراجعة">
      <p className="form-status">Media UID: {data.mediaUid}</p>
      <p className="form-status">Permission: {data.review.permission}</p>
      {data.review.expiresAt ? (
        <p className="form-status">Expires: {data.review.expiresAt}</p>
      ) : null}
      {data.comments.length === 0 ? (
        <p className="form-status">لا توجد تعليقات متاحة لهذا الرابط.</p>
      ) : (
        data.comments.map((comment) => (
          <article className="panel" key={comment.id}>
            <h2>{comment.author}</h2>
            <p>{comment.body}</p>
            <p className="token-preview">TC {comment.timecodeSeconds}</p>
          </article>
        ))
      )}
    </div>
  );
}
