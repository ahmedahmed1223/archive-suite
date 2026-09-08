"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type AuthorityEntity, type RecordAuthorityEntityLink } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function RecordAuthorityEntitiesPanel({ recordId, canEdit }: Readonly<{ recordId: string; canEdit: boolean }>) {
  const { locale } = useLocale();
  const copy = locale === "ar"
    ? { title: "سجلات الاستناد", description: "أشخاص ومؤسسات وأماكن مرتبطة بهذه المادة بوصف مضبوط.", empty: "لا توجد سجلات استناد مرتبطة بعد.", entity: "السجل", relation: "نوع العلاقة", add: "ربط السجل", failed: "تعذر تحديث سجلات الاستناد.", loading: "جارٍ تحميل سجلات الاستناد..." }
    : { title: "Authority records", description: "Controlled people, organizations, and places linked to this record.", empty: "No authority records are linked yet.", entity: "Authority record", relation: "Relationship", add: "Link record", failed: "Could not update authority records.", loading: "Loading authority records..." };
  const api = useMemo(() => createArchiveApiClient(), []);
  const [links, setLinks] = useState<RecordAuthorityEntityLink[]>([]);
  const [entities, setEntities] = useState<AuthorityEntity[]>([]);
  const [entityId, setEntityId] = useState("");
  const [relationship, setRelationship] = useState("subject");
  const [status, setStatus] = useState(copy.loading);

  useEffect(() => {
    void Promise.all([api.recordAuthorityEntities(recordId), api.authorityEntities()]).then(([linksResponse, entitiesResponse]) => {
      if (!linksResponse.ok || !entitiesResponse.ok) { setStatus(copy.failed); return; }
      setLinks(linksResponse.links); setEntities(entitiesResponse.entities); setStatus("");
    }).catch(() => setStatus(copy.failed));
  }, [api, copy.failed, recordId]);

  async function addLink() {
    if (!entityId) return;
    const response = await api.linkRecordAuthorityEntity(recordId, { entityId, relationship });
    if (!response.ok) { setStatus(response.error || copy.failed); return; }
    setLinks((current) => [...current.filter((link) => link.entity.id !== response.link.entity.id), response.link]);
    setEntityId(""); setStatus("");
  }

  return <article className="panel">
    <div className="panel-section-header"><div><h2>{copy.title}</h2><p className="helper-text">{copy.description}</p></div></div>
    {status ? <p className="form-status" role="status">{status}</p> : null}
    {links.length ? <div className="tags">{links.map((link) => <span className="tag" key={link.id}>{link.entity.preferredLabel} · {link.relationship}</span>)}</div> : !status ? <p className="helper-text">{copy.empty}</p> : null}
    {canEdit ? <div className="archive-toolbar-grid section-divider"><label><span>{copy.entity}</span><select value={entityId} onChange={(event) => setEntityId(event.target.value)}><option value="" />{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.preferredLabel} · {entity.kind}</option>)}</select></label><label><span>{copy.relation}</span><input className="search-input" value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="button" disabled={!entityId || !relationship.trim()} onClick={() => void addLink()}>{copy.add}</button></div></div> : null}
  </article>;
}
