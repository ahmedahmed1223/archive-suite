"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchiveApiClient, type AuthorityEntity, type TimedDescriptionSegment, type TimedDescriptionSegmentAuthorityEntityLink } from "@/lib/archive-api";

export default function TimedDescriptionSegmentsPanel({ recordId }: Readonly<{ recordId: string }>) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [segments, setSegments] = useState<TimedDescriptionSegment[]>([]);
  const [authorityEntities, setAuthorityEntities] = useState<AuthorityEntity[]>([]);
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
  useEffect(() => { void api.authorityEntities().then((response) => response.ok ? setAuthorityEntities(response.entities) : undefined); }, [api]);
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
  async function deleteSegment(id: string) {
    const response = await api.deleteTimedDescriptionSegment(id);
    if (!response.ok) { setError(response.error || "تعذر حذف المقطع."); return; }
    setSegments((current) => current.filter((segment) => segment.id !== id));
  }

  return <article className="panel"><div className="panel-section-header"><div><h2>التوصيف الزمني</h2><p className="helper-text">مقاطع وصفية مرتبطة بإطارات الفيديو، ولا تغيّر الملف أو المونتاج.</p></div><span className="badge">{segments.length}</span></div>{canDescribe ? <form className="archive-toolbar-grid" onSubmit={createSegment}><label><span>العنوان</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label><span>بداية الإطار</span><input type="number" min="0" value={startFrame} onChange={(e) => setStartFrame(e.target.value)} required /></label><label><span>نهاية الإطار</span><input type="number" min="1" value={endFrame} onChange={(e) => setEndFrame(e.target.value)} required /></label><label><span>الوصف</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label><label><span>الأشخاص والموضوعات</span><input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="افصل بفواصل" /></label><label><span>المكان</span><input value={place} onChange={(e) => setPlace(e.target.value)} /></label><label><span>ملاحظة الحقوق</span><input value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} /></label><button className="button button-primary" disabled={!title || !endFrame}>إضافة مقطع</button></form> : null}{error ? <p className="form-status" role="alert">{error}</p> : null}{segments.length ? <ol className="mobile-field-list">{segments.map((segment) => <li key={segment.id}><strong>{segment.title}</strong><span dir="ltr">{segment.startFrame}–{segment.endFrame} frames</span>{segment.description ? <small>{segment.description}</small> : null}{canDescribe ? <button className="button button-ghost button-sm" type="button" aria-label={`حذف المقطع: ${segment.title}`} onClick={() => void deleteSegment(segment.id)}>حذف</button> : null}<TimedDescriptionSegmentAuthorityLinks api={api} segment={segment} entities={authorityEntities} canEdit={canDescribe} /></li>)}</ol> : !error ? <EmptyState title="لا توجد مقاطع موصوفة بعد." description="أضف مقاطع وصفية بالإطارات من مساحة التوصيف." /> : null}</article>;
}

function TimedDescriptionSegmentAuthorityLinks({ api, segment, entities, canEdit }: Readonly<{ api: ArchiveApiClient; segment: TimedDescriptionSegment; entities: AuthorityEntity[]; canEdit: boolean }>) {
  const [links, setLinks] = useState<TimedDescriptionSegmentAuthorityEntityLink[]>([]);
  const [entityId, setEntityId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => { void api.timedDescriptionSegmentAuthorityEntities(segment.id).then((response) => response.ok ? setLinks(response.links) : setStatus("تعذر تحميل روابط الاستناد للمقطع.")); }, [api, segment.id]);

  async function linkEntity() {
    if (!entityId) return;
    const response = await api.linkTimedDescriptionSegmentAuthorityEntity(segment.id, { entityId, relationship: "on_screen" });
    if (!response.ok) { setStatus(response.error || "تعذر ربط سجل الاستناد."); return; }
    setLinks((current) => [...current.filter((link) => link.entity.id !== response.link.entity.id), response.link]);
    setEntityId("");
    setStatus("");
  }

  async function unlinkEntity(entityId: string) {
    const response = await api.unlinkTimedDescriptionSegmentAuthorityEntity(segment.id, entityId);
    if (!response.ok) { setStatus(response.error || "تعذر إزالة سجل الاستناد."); return; }
    setLinks((current) => current.filter((link) => link.entity.id !== entityId));
  }

  return <div className="section-divider"><span className="helper-text">سجلات الاستناد المرتبطة بالمقطع</span>{links.length ? <div className="tags">{links.map((link) => <span className="tag" key={link.id}>{link.entity.preferredLabel} · {link.relationship}{canEdit ? <button className="button button-ghost button-sm" type="button" onClick={() => void unlinkEntity(link.entity.id)}>إزالة</button> : null}</span>)}</div> : null}{status ? <p className="form-status" role="status">{status}</p> : null}{canEdit ? <div className="archive-toolbar-grid"><label><span>سجل استنادي للمقطع: {segment.title}</span><select value={entityId} onChange={(event) => setEntityId(event.target.value)}><option value="" />{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.preferredLabel}</option>)}</select></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="button" disabled={!entityId} onClick={() => void linkEntity()}>ربط السجل الاستنادي</button></div></div> : null}</div>;
}
