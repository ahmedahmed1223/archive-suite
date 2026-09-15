'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
  const records = data?.records || [];

  if (error) {
    return (
      <div className="flex flex-col h-full" dir="rtl">
        <header className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-gray-600">{copy.description}</p>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{copy.error}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
            >
              {copy.actions.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-sm text-gray-600">{copy.description}</p>
      </header>

      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGE_ORDER.map((stage) => {
            const stageInfo = copy.stages[stage];
            const count = stageCounts[stage] || 0;
            const isSelected = selectedStage === stage;

            return (
              <button
                key={stage}
                onClick={() => handleStageSelect(stage)}
                className={`p-3 rounded border text-right cursor-pointer transition ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <span>{stageInfo.icon}</span>
                  <span>{stageInfo.label}</span>
                </div>
                <div className="text-2xl font-semibold mt-2">{count}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <Skeleton label={copy.loading} />
        ) : records.length === 0 ? (
          <EmptyState
            title={copy.empty.title}
            description={copy.empty.description}
          />
        ) : (
          <div className="divide-y divide-gray-200">
            {records.map((record) => (
              <Link
                key={record.uid}
                href={`/archive/${record.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{record.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {(copy.stageReasons as Record<MaterialStage, string>)[record.stage]}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 mr-4">
                    {record.updatedAt && new Date(record.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
