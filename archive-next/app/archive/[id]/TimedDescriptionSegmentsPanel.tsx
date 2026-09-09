"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, type TimedDescriptionSegment } from "@/lib/archive-api";

export default function TimedDescriptionSegmentsPanel({ recordId }: Readonly<{ recordId: string }>) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [segments, setSegments] = useState<TimedDescriptionSegment[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void api.timedDescriptionSegments(recordId).then((response) => response.ok ? setSegments(response.segments) : setError(response.error || "تعذر تحميل التوصيف الزمني.")); }, [api, recordId]);
  return <article className="panel"><div className="panel-section-header"><div><h2>التوصيف الزمني</h2><p className="helper-text">مقاطع وصفية مرتبطة بإطارات الفيديو، ولا تغيّر الملف أو المونتاج.</p></div><span className="badge">{segments.length}</span></div>{error ? <p className="form-status" role="alert">{error}</p> : null}{segments.length ? <ol className="mobile-field-list">{segments.map((segment) => <li key={segment.id}><strong>{segment.title}</strong><span dir="ltr">{segment.startFrame}–{segment.endFrame} frames</span>{segment.description ? <small>{segment.description}</small> : null}</li>)}</ol> : !error ? <EmptyState title="لا توجد مقاطع موصوفة بعد." description="أضف مقاطع وصفية بالإطارات من مساحة التوصيف." /> : null}</article>;
}
