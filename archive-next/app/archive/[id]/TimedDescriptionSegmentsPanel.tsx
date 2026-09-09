"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchiveApiClient, type AuthorityEntity, type TimedDescriptionSegment, type TimedDescriptionSegmentAuthorityEntityLink } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function TimedDescriptionSegmentsPanel({ recordId }: Readonly<{ recordId: string }>) {
  const { t } = useLocale();
  const copy = t.pages.timedDescriptions;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [segments, setSegments] = useState<TimedDescriptionSegment[]>([]);
  const [authorityEntities, setAuthorityEntities] = useState<AuthorityEntity[]>([]);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [startFrame, setStartFrame] = useState("0");
  const [endFrame, setEndFrame] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState("");
  const [place, setPlace] = useState("");
  const [rightsNote, setRightsNote] = useState("");
  const canDescribe = useCapability("records.edit");
  useEffect(() => { void api.timedDescriptionSegments(recordId).then((response) => response.ok ? setSegments(response.segments) : setError(response.error || copy.loadError)); }, [api, copy.loadError, recordId]);
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
    } else setError(response.error || copy.saveError);
  }
  async function deleteSegment(id: string) {
    const response = await api.deleteTimedDescriptionSegment(id);
    if (!response.ok) { setError(response.error || copy.deleteError); return; }
    setSegments((current) => current.filter((segment) => segment.id !== id));
  }

  return (
    <article className="panel">
      <div className="panel-section-header">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{segments.length}</span>
      </div>
      {canDescribe ? <form className="archive-toolbar-grid" onSubmit={createSegment}>
        <label><span>{copy.titleLabel}</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label><span>{copy.startFrameLabel}</span><input type="number" min="0" value={startFrame} onChange={(e) => setStartFrame(e.target.value)} required /></label>
        <label><span>{copy.endFrameLabel}</span><input type="number" min="1" value={endFrame} onChange={(e) => setEndFrame(e.target.value)} required /></label>
        <label><span>{copy.descriptionLabel}</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label><span>{copy.subjectsLabel}</span><input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder={copy.subjectsPlaceholder} /></label>
        <label><span>{copy.placeLabel}</span><input value={place} onChange={(e) => setPlace(e.target.value)} /></label>
        <label><span>{copy.rightsNoteLabel}</span><input value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} /></label>
        <button className="button button-primary" disabled={!title || !endFrame}>{copy.addSegment}</button>
      </form> : null}
      {error ? <p className="form-status" role="alert">{error}</p> : null}
      {segments.length ? <ol className="mobile-field-list">
        {segments.map((segment) => <li key={segment.id} id={`timed-description-${segment.id}`}>
          <strong>{segment.title}</strong>
          <span dir="ltr">{segment.startFrame}–{segment.endFrame} {copy.frames}</span>
          {segment.description ? <small>{segment.description}</small> : null}
          {canDescribe ? <>
            <button className="button button-ghost button-sm" type="button" aria-label={copy.editSegment.replace("{title}", segment.title)} onClick={() => setEditingSegmentId(segment.id)}>{copy.edit}</button>
            <button className="button button-ghost button-sm" type="button" aria-label={copy.deleteSegment.replace("{title}", segment.title)} onClick={() => void deleteSegment(segment.id)}>{copy.delete}</button>
            {editingSegmentId === segment.id ? <TimedDescriptionSegmentEditor api={api} segment={segment} onCancel={() => setEditingSegmentId(null)} onSaved={(updated) => { setSegments((current) => current.map((item) => item.id === updated.id ? updated : item)); setEditingSegmentId(null); }} /> : null}
          </> : null}
          <TimedDescriptionSegmentAuthorityLinks api={api} segment={segment} entities={authorityEntities} canEdit={canDescribe} />
        </li>)}
      </ol> : !error ? <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} /> : null}
    </article>
  );
}

function TimedDescriptionSegmentAuthorityLinks({ api, segment, entities, canEdit }: Readonly<{ api: ArchiveApiClient; segment: TimedDescriptionSegment; entities: AuthorityEntity[]; canEdit: boolean }>) {
  const { t } = useLocale();
  const copy = t.pages.timedDescriptions;
  const [links, setLinks] = useState<TimedDescriptionSegmentAuthorityEntityLink[]>([]);
  const [entityId, setEntityId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => { void api.timedDescriptionSegmentAuthorityEntities(segment.id).then((response) => response.ok ? setLinks(response.links) : setStatus(copy.authorityLoadError)); }, [api, copy.authorityLoadError, segment.id]);

  async function linkEntity() {
    if (!entityId) return;
    const response = await api.linkTimedDescriptionSegmentAuthorityEntity(segment.id, { entityId, relationship: "on_screen" });
    if (!response.ok) { setStatus(response.error || copy.authorityLinkError); return; }
    setLinks((current) => [...current.filter((link) => link.entity.id !== response.link.entity.id), response.link]);
    setEntityId("");
    setStatus("");
  }

  async function unlinkEntity(entityId: string) {
    const response = await api.unlinkTimedDescriptionSegmentAuthorityEntity(segment.id, entityId);
    if (!response.ok) { setStatus(response.error || copy.authorityUnlinkError); return; }
    setLinks((current) => current.filter((link) => link.entity.id !== entityId));
  }

  return <div className="section-divider"><span className="helper-text">{copy.linkedAuthorities}</span>{links.length ? <div className="tags">{links.map((link) => <span className="tag" key={link.id}>{link.entity.preferredLabel} · {link.relationship}{canEdit ? <button className="button button-ghost button-sm" type="button" onClick={() => void unlinkEntity(link.entity.id)}>{copy.unlink}</button> : null}</span>)}</div> : null}{status ? <p className="form-status" role="status">{status}</p> : null}{canEdit ? <div className="archive-toolbar-grid"><label><span>{copy.authorityForSegment.replace("{title}", segment.title)}</span><select value={entityId} onChange={(event) => setEntityId(event.target.value)}><option value="" />{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.preferredLabel}</option>)}</select></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="button" disabled={!entityId} onClick={() => void linkEntity()}>{copy.linkAuthority}</button></div></div> : null}</div>;
}

function TimedDescriptionSegmentEditor({ api, segment, onSaved, onCancel }: Readonly<{ api: ArchiveApiClient; segment: TimedDescriptionSegment; onSaved: (segment: TimedDescriptionSegment) => void; onCancel: () => void }>) {
  const { t } = useLocale();
  const copy = t.pages.timedDescriptions;
  const [title, setTitle] = useState(segment.title);
  const [startFrame, setStartFrame] = useState(String(segment.startFrame));
  const [endFrame, setEndFrame] = useState(String(segment.endFrame));
  const [description, setDescription] = useState(segment.description ?? "");
  const [subjects, setSubjects] = useState(segment.subjects.join("، "));
  const [place, setPlace] = useState(segment.place ?? "");
  const [rightsNote, setRightsNote] = useState(segment.rightsNote ?? "");
  const [error, setError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await api.updateTimedDescriptionSegment(segment.id, {
      title: title.trim(),
      startFrame: Number(startFrame),
      endFrame: Number(endFrame),
      description: description.trim() || null,
      subjects: subjects.split(/[,،]/).map((subject) => subject.trim()).filter(Boolean),
      place: place.trim() || null,
      rightsNote: rightsNote.trim() || null,
    });
    if (!response.ok) { setError(response.error || copy.editSaveError); return; }
    onSaved(response.segment);
  }

  return <form className="archive-toolbar-grid section-divider" onSubmit={save}><label><span>{copy.segmentTitle.replace("{title}", segment.title)}</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label><span>{copy.segmentStartFrame.replace("{title}", segment.title)}</span><input type="number" min="0" value={startFrame} onChange={(event) => setStartFrame(event.target.value)} required /></label><label><span>{copy.segmentEndFrame.replace("{title}", segment.title)}</span><input type="number" min="1" value={endFrame} onChange={(event) => setEndFrame(event.target.value)} required /></label><label><span>{copy.segmentDescription.replace("{title}", segment.title)}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label><span>{copy.segmentSubjects.replace("{title}", segment.title)}</span><input value={subjects} onChange={(event) => setSubjects(event.target.value)} /></label><label><span>{copy.segmentPlace.replace("{title}", segment.title)}</span><input value={place} onChange={(event) => setPlace(event.target.value)} /></label><label><span>{copy.segmentRightsNote.replace("{title}", segment.title)}</span><input value={rightsNote} onChange={(event) => setRightsNote(event.target.value)} /></label><div className="archive-toolbar-actions"><button className="button button-primary" disabled={!title.trim() || !endFrame}>{copy.saveEdit}</button><button className="button button-secondary" type="button" onClick={onCancel}>{copy.cancel}</button></div>{error ? <p className="form-status" role="alert">{error}</p> : null}</form>;
}
