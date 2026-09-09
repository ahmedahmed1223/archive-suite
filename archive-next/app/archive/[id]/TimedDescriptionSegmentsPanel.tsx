"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type TimedDescriptionSegment } from "@/lib/archive-api";

export default function TimedDescriptionSegmentsPanel({ recordId }: Readonly<{ recordId: string }>) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [segments, setSegments] = useState<TimedDescriptionSegment[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [startFrame, setStartFrame] = useState("0");
  const [endFrame, setEndFrame] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState("");
  const [place, setPlace] = useState("");
  const [rightsNote, setRightsNote] = useState("");
  const canDescribe = useCapability("records.edit");
  useEffect(() => { void api.timedDescriptionSegments(recordId).then((response) => response.ok ? setSegments(response.segments) : setError(response.error || "تعذر تحميل التوصيف الزمني.")); }, [api, recordId]);
  async function createSegment(event: FormEvent) {
    event.preventDefault();
    const response = await api.createTimedDescriptionSegment(recordId, {
      title: title.trim(),
      startFrame: Number(startFrame),
      endFrame: Number(endFrame),
      description: description.trim() || null,
      subjects: subjects.split(/[,،]/).map((subject) => subject.trim()).filter(Boolean),
      place: place.trim() || null,
      rightsNote: rightsNote.trim() || null
    });
    if (response.ok) {
      setSegments((current) => [...current, response.segment]);
      setTitle("");
      setEndFrame("");
      setDescription("");
      setSubjects("");
      setPlace("");
      setRightsNote("");
    } else setError(response.error || "تعذر حفظ المقطع.");
  }
  return <article className="panel"><div className="panel-section-header"><div><h2>التوصيف الزمني</h2><p className="helper-text">مقاطع وصفية مرتبطة بإطارات الفيديو، ولا تغيّر الملف أو المونتاج.</p></div><span className="badge">{segments.length}</span></div>{canDescribe ? <form className="archive-toolbar-grid" onSubmit={createSegment}><label><span>العنوان</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label><span>بداية الإطار</span><input type="number" min="0" value={startFrame} onChange={(e) => setStartFrame(e.target.value)} required /></label><label><span>نهاية الإطار</span><input type="number" min="1" value={endFrame} onChange={(e) => setEndFrame(e.target.value)} required /></label><label><span>الوصف</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label><label><span>الأشخاص والموضوعات</span><input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="افصل بفواصل" /></label><label><span>المكان</span><input value={place} onChange={(e) => setPlace(e.target.value)} /></label><label><span>ملاحظة الحقوق</span><input value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} /></label><button className="button button-primary" disabled={!title || !endFrame}>إضافة مقطع</button></form> : null}{error ? <p className="form-status" role="alert">{error}</p> : null}{segments.length ? <ol className="mobile-field-list">{segments.map((segment) => <li key={segment.id}><strong>{segment.title}</strong><span dir="ltr">{segment.startFrame}–{segment.endFrame} frames</span>{segment.description ? <small>{segment.description}</small> : null}</li>)}</ol> : !error ? <EmptyState title="لا توجد مقاطع موصوفة بعد." description="أضف مقاطع وصفية بالإطارات من مساحة التوصيف." /> : null}</article>;
}
