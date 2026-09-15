'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { createArchiveApiClient } from '@/lib/archive-api';

type MaterialStage =
  | 'new_receipt'
  | 'tech_check_failed'
  | 'incomplete_description'
  | 'missing_rights'
  | 'ready_for_approval'
  | 'processing_failed'
  | 'awaiting_peer'
  | 'completed_today';

interface MaterialInboxRecord {
  id: string;
  uid: string;
  title: string;
  stage: MaterialStage;
  createdAt: string;
  updatedAt: string;
}

interface MaterialsInboxResponse {
  ok: boolean;
  records: MaterialInboxRecord[];
  stageCounts: Record<MaterialStage, number>;
  nextCursor?: string | null;
}

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['materials-inbox', selectedStage],
    queryFn: async () => {
      const response = await api.getMaterialsInbox({
        query: {
          store: 'archive-items',
          ...(selectedStage && { stage: selectedStage }),
        },
      });
      return response.ok ? response : null;
    },
  });

  const handleStageSelect = useCallback((stage: MaterialStage) => {
    setSelectedStage(selectedStage === stage ? null : stage);
  }, [selectedStage]);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">{t.materialsInbox.error}</div>
      </div>
    );
  }

  const stageCounts = data?.stageCounts || {};
  const records = data?.records || [];

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold">{t.materialsInbox.title}</h1>
        <p className="text-sm text-gray-600">{t.materialsInbox.description}</p>
      </header>

      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGE_ORDER.map((stage) => {
            const stageInfo = t.materialsInbox.stages[stage];
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
          <div className="p-6 text-center text-gray-600">{t.materialsInbox.loading}</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900">{t.materialsInbox.empty.title}</h3>
            <p className="text-sm text-gray-600 mt-2">{t.materialsInbox.empty.description}</p>
          </div>
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
                      {t.materialsInbox.stageReasons[record.stage]}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 mr-4">
                    {new Date(record.updatedAt).toLocaleDateString()}
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
