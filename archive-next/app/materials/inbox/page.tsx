'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AppShell from '@/components/AppShell';
import PageToolbar from '@/components/PageToolbar';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { createArchiveApiClient, type MaterialStage, type MaterialInboxRecord } from '@/lib/archive-api';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/EmptyState';

const STAGE_ORDER: MaterialStage[] = [
  'new_receipt',
  'tech_check_failed',
  'incomplete_description',
  'missing_rights',
  'ready_for_approval',
  'processing_failed',
  'awaiting_peer',
  'completed_today',
];

/**
 * V2-OPS-001: the stage view of a material's journey. It renders inside the
 * app shell like every other daily destination -- before this it drew its own
 * bare page with its own colours, so reaching it dropped the operator out of
 * the navigation entirely, and the route was not even listed there.
 */
export default function MaterialsInboxPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [selectedStage, setSelectedStage] = useState<MaterialStage | null>(null);
  const copy = t.pages.materialsInbox;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['materials-inbox', selectedStage],
    queryFn: async () => {
      const response = await api.getMaterialsInbox({
        query: {
          store: 'archive-items',
          ...(selectedStage && { stage: selectedStage }),
        },
      });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to load materials');
      }
      return response;
    },
  });

  const handleStageSelect = useCallback((stage: MaterialStage) => {
    setSelectedStage(selectedStage === stage ? null : stage);
  }, [selectedStage]);

  const stageCounts = data?.stageCounts || {};
  const records: MaterialInboxRecord[] = data?.records || [];

  return (
    <AppShell subtitle={copy.title} contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        actions={<><a className="button button-secondary" href="/work-inbox">{copy.openWorkInbox}</a><a className="button button-secondary" href="/uploads">{copy.openUploads}</a></>}
      >
        <div className="archive-toolbar-row" role="group" aria-label={copy.stagesAriaLabel}>
          {STAGE_ORDER.map((stage) => {
            const stageInfo = copy.stages[stage];
            return (
              <button
                key={stage}
                type="button"
                className="badge"
                data-active={selectedStage === stage ? 'true' : 'false'}
                aria-pressed={selectedStage === stage}
                onClick={() => handleStageSelect(stage)}
              >
                <span aria-hidden="true">{stageInfo.icon}</span> {stageInfo.label} <strong>{stageCounts[stage] || 0}</strong>
              </button>
            );
          })}
          {selectedStage ? (
            <button type="button" className="button button-secondary button-sm" onClick={() => setSelectedStage(null)}>
              {copy.clearStage}
            </button>
          ) : null}
        </div>
      </PageToolbar>

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.error}</strong>
          <span className="helper-text">{error instanceof Error ? error.message : copy.error}</span>
          <div>
            <button type="button" className="button button-secondary button-sm" onClick={() => void refetch()}>
              {copy.actions.retry}
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? <div className="panel panel-compact"><Skeleton label={copy.loading} /></div> : null}

      {!isLoading && !error && records.length === 0 ? (
        <EmptyState title={copy.empty.title} description={copy.empty.description} />
      ) : null}

      {!isLoading && records.length > 0 ? (
        <section className="panel" aria-label={copy.listAriaLabel}>
          <ul className="record-note-list">
            {records.map((record) => (
              <li key={record.uid}>
                <Link className="text-accent" href={`/archive/${record.id}`}>{record.title}</Link>
                <p className="helper-text">
                  {(copy.stageReasons as Record<MaterialStage, string>)[record.stage]}
                </p>
                {record.updatedAt ? (
                  <span className="helper-text" dir="ltr">{new Date(record.updatedAt).toISOString().slice(0, 10)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
