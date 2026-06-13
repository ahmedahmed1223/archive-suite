import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Link2, Plus, Trash2 } from "lucide-react";

import { getRelationLabel, buildRelationsGraph } from "../../features/relations/viewModel.js";
import { RelationsGraph } from "./RelationsGraph.jsx";

function getItemTitle(item) {
  return item?.title || item?.name || item?.id || "عنصر غير معروف";
}

function RelationRow({ relation, otherItem, fromSourcePerspective, onRemove }) {
  const label = getRelationLabel(relation.type, fromSourcePerspective);
  return (
    <li className="group flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.06]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            {label}
          </span>
          <span className="truncate text-sm font-medium text-gray-100">{getItemTitle(otherItem)}</span>
        </div>
        {relation.note ? (
          <p className="mt-1 truncate text-xs text-gray-400">{relation.note}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onRemove?.(relation.id)}
        aria-label={`حذف العلاقة مع ${getItemTitle(otherItem)}`}
        className="shrink-0 rounded-lg p-1.5 text-gray-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function RelationSection({ title, icon, relations, resolveOther, fromSourcePerspective, onRemove, emptyHint }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-300">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-white/5 px-1.5 text-xs text-gray-400">{relations.length}</span>
      </h3>
      {relations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-gray-500">{emptyHint}</p>
      ) : (
        <ul className="space-y-1.5" role="list">
          {relations.map((relation) => (
            <RelationRow
              key={relation.id}
              relation={relation}
              otherItem={resolveOther(relation)}
              fromSourcePerspective={fromSourcePerspective}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Renders an item's explicit relations, split into outgoing and incoming.
 *
 * @param {object} props
 * @param {string} props.itemId
 * @param {{ outgoing: object[], incoming: object[] }} props.itemRelations
 * @param {object[]} props.allItems
 * @param {() => void} props.onAddRelation
 * @param {(id: string) => void} props.onRemoveRelation
 */
export function RelationsPanel({
  itemId,
  itemRelations = { outgoing: [], incoming: [] },
  allItems = [],
  onAddRelation,
  onRemoveRelation,
  onNavigateToItem
}) {
  const itemsById = React.useMemo(
    () => new Map(allItems.map((item) => [item.id, item])),
    [allItems]
  );

  const outgoing = itemRelations.outgoing || [];
  const incoming = itemRelations.incoming || [];
  const isEmpty = outgoing.length === 0 && incoming.length === 0;

  const allRelations = React.useMemo(() => [...outgoing, ...incoming], [outgoing, incoming]);
  const graph = React.useMemo(
    () => buildRelationsGraph(itemId, allRelations, allItems, 1),
    [itemId, allRelations, allItems]
  );

  return (
    <section
      role="region"
      aria-label="علاقات العنصر"
      dir="rtl"
      className="space-y-4 rounded-2xl border border-white/10 bg-gray-900/50 p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Link2 className="h-5 w-5 va-accent-text" aria-hidden="true" />
          <span>العلاقات</span>
        </h2>
        <button
          type="button"
          onClick={() => onAddRelation?.()}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>إضافة علاقة</span>
        </button>
      </header>

      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
          <Link2 className="mx-auto h-8 w-8 text-gray-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-gray-300">لا توجد علاقات بعد</p>
          <p className="mt-1 text-xs text-gray-500">اربط هذا العنصر بعناصر أخرى لتوثيق الصلات بينها.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <RelationsGraph
            graph={graph}
            centerId={itemId}
            onNodeClick={(id) => { if (id !== itemId) onNavigateToItem?.(id); }}
            className="w-full"
          />
          <RelationSection
            title="علاقات صادرة"
            icon={<ArrowUpRight className="h-4 w-4 text-emerald-400" aria-hidden="true" />}
            relations={outgoing}
            resolveOther={(relation) => itemsById.get(relation.targetId)}
            fromSourcePerspective
            onRemove={onRemoveRelation}
            emptyHint="لا توجد علاقات صادرة من هذا العنصر."
          />
          <RelationSection
            title="علاقات واردة"
            icon={<ArrowDownLeft className="h-4 w-4 text-sky-400" aria-hidden="true" />}
            relations={incoming}
            resolveOther={(relation) => itemsById.get(relation.sourceId)}
            fromSourcePerspective={false}
            onRemove={onRemoveRelation}
            emptyHint="لا توجد علاقات واردة إلى هذا العنصر."
          />
        </div>
      )}
    </section>
  );
}

RelationsPanel.displayName = "RelationsPanel";

export default RelationsPanel;
