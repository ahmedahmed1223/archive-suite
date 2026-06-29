import * as React from "react";
import { FolderOpen, FolderPlus, Plus, Search, Trash2 } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import {
  FOLDER_SCOPE_LABELS,
  buildFolderTree,
  getFolderEntityIds
} from "../../features/folders/viewModel.js";
import { formatNumber } from "../../utils/formatting.js";
import { FolderTree } from "./FolderTree.jsx";

function defaultLabelFor(entity: any = {}) {
  return entity.title || entity.name || entity.term || entity.label || entity.id || "عنصر";
}

export function EntityFoldersPanel({
  scope = "archive",
  entityType = "archive-item",
  entities = [],
  title,
  description,
  getEntityLabel = defaultLabelFor,
  getEntityMeta
}: any) {
  const {
    folders = [],
    createFolder,
    deleteFolder,
    toggleFolderExpanded,
    addEntityToFolder,
    removeEntityFromFolder,
    showToast
  } = useAppStore();

  const scopedFolders = React.useMemo(
    () => folders.filter((folder: any) => (folder.scope || "archive") === scope),
    [folders, scope]
  );
  const tree = React.useMemo(() => buildFolderTree(scopedFolders), [scopedFolders]);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null);
  const [folderName, setFolderName] = React.useState("");
  const [query, setQuery] = React.useState("");
  const selectedFolder = selectedFolderId ? (tree.byId as any)[selectedFolderId] : null;
  const assignedIds = React.useMemo(() => new Set(getFolderEntityIds(selectedFolder, entityType)), [entityType, selectedFolder]);
  const normalizedQuery = query.trim().toLowerCase();
  const available = React.useMemo(() => {
    const list = entities.filter((entity: any) => entity?.id && !assignedIds.has(entity.id));
    if (!normalizedQuery) return list;
    return list.filter((entity: any) => getEntityLabel(entity).toLowerCase().includes(normalizedQuery));
  }, [assignedIds, entities, getEntityLabel, normalizedQuery]);
  const assigned = React.useMemo(
    () => entities.filter((entity: any) => assignedIds.has(entity.id)),
    [assignedIds, entities]
  );

  React.useEffect(() => {
    if (!selectedFolderId || (tree.byId as any)[selectedFolderId]) return;
    setSelectedFolderId(null);
  }, [selectedFolderId, tree.byId]);

  const createScopedFolder = async (event: any) => {
    event.preventDefault();
    if (!folderName.trim()) return;
    const created = await createFolder?.({
      name: folderName,
      scope,
      parentId: selectedFolderId || null,
      icon: "📁"
    });
    setFolderName("");
    if (created?.id) setSelectedFolderId(created.id);
  };

  const addEntity = async (entity: any) => {
    if (!selectedFolderId) {
      showToast?.("اختر مجلداً أولاً.", "warning");
      return;
    }
    await addEntityToFolder?.(selectedFolderId, entityType, entity.id);
  };

  const removeEntity = async (entity: any) => {
    if (!selectedFolderId) return;
    await removeEntityFromFolder?.(selectedFolderId, entityType, entity.id);
  };

  const removeFolder = async () => {
    if (!selectedFolderId) return;
    await deleteFolder?.(selectedFolderId);
    setSelectedFolderId(null);
  };

  return (
    <section className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 text-right shadow-[var(--va-elev-1)]" dir="rtl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--va-text)]">
            <FolderOpen className="h-5 w-5 va-accent-text" />
            {title || `مجلدات ${(FOLDER_SCOPE_LABELS as any)[scope] || "القسم"}`}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--va-text-muted)]">
            {description || "نظم عناصر هذا القسم داخل مجلدات يدوية مستقلة."}
          </p>
        </div>
        {selectedFolder && (
          <button
            type="button"
            onClick={removeFolder}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف المجلد
          </button>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
        <aside className="space-y-3 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
          <form onSubmit={createScopedFolder} className="flex gap-2">
            <input
              value={folderName}
              onChange={(event: any) => setFolderName(event.target.value)}
              placeholder={selectedFolder ? `مجلد داخل ${(selectedFolder as any).name}` : "مجلد جديد"}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-3 text-sm text-[var(--va-text)] outline-none"
            />
            <button type="submit" disabled={!folderName.trim()} className="btn btn-primary min-h-10 gap-1.5">
              <FolderPlus className="h-4 w-4" />
              إنشاء
            </button>
          </form>
          <FolderTree
            folders={scopedFolders}
            selectedFolderId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onToggle={toggleFolderExpanded}
            onCreateFolder={() => {
              if (!folderName.trim()) setFolderName("مجلد جديد");
            }}
            title={`مجلدات ${(FOLDER_SCOPE_LABELS as any)[scope] || "القسم"}`}
            emptyDescription="أنشئ مجلداً لتنظيم عناصر هذا القسم."
            countEntityType={entityType}
          />
        </aside>

        <div className="space-y-3">
          {selectedFolder ? (
            <>
              <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--va-text)]">{(selectedFolder as any).name || "مجلد"}</h3>
                    <p className="mt-1 text-xs text-[var(--va-text-muted)]">
                      {formatNumber(assigned.length)} عنصر داخل هذا المجلد
                    </p>
                  </div>
                  <label className="relative block min-w-[14rem]">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-text-muted)]" />
                    <input
                      value={query}
                      onChange={(event: any) => setQuery(event.target.value)}
                      placeholder="بحث للإضافة"
                      className="min-h-10 w-full rounded-xl border border-[var(--va-border-strong)] bg-[var(--va-surface)] py-2 pl-3 pr-10 text-sm text-[var(--va-text)] outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
                  <h3 className="mb-2 text-sm font-bold text-[var(--va-text)]">داخل المجلد</h3>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {assigned.length ? assigned.map((entity: any) => (
                      <div key={entity.id} className="flex items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--va-text)]" dir="auto">{getEntityLabel(entity)}</p>
                          {getEntityMeta && <p className="truncate text-xs text-[var(--va-text-muted)]">{getEntityMeta(entity)}</p>}
                        </div>
                        <button type="button" onClick={() => removeEntity(entity)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10" aria-label={`إزالة ${getEntityLabel(entity)}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )) : (
                      <p className="rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-center text-xs text-[var(--va-text-muted)]">لا توجد عناصر داخل هذا المجلد.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
                  <h3 className="mb-2 text-sm font-bold text-[var(--va-text)]">إضافة إلى المجلد</h3>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {available.length ? available.slice(0, 200).map((entity: any) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => addEntity(entity)}
                        className="flex w-full items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-right hover:border-[var(--va-border-strong)] hover:bg-[var(--va-elevated)]"
                      >
                        <Plus className="h-4 w-4 shrink-0 va-accent-text" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--va-text)]" dir="auto">{getEntityLabel(entity)}</span>
                        {getEntityMeta && <span className="shrink-0 text-xs text-[var(--va-text-muted)]">{getEntityMeta(entity)}</span>}
                      </button>
                    )) : (
                      <p className="rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-center text-xs text-[var(--va-text-muted)]">كل العناصر الظاهرة موجودة في هذا المجلد أو لا توجد نتائج بحث.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-6 text-center">
              <FolderOpen className="h-12 w-12 text-[var(--va-text-muted)]" />
              <h3 className="mt-3 text-base font-bold text-[var(--va-text)]">اختر مجلداً</h3>
              <p className="mt-1 text-sm text-[var(--va-text-muted)]">بعد اختيار مجلد يمكنك إضافة عناصر هذا القسم إليه أو إزالتها منه.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default EntityFoldersPanel;
