"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type SavedSearch } from "@/lib/archive-api";
import type { ExperienceSettings, UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";
import type { components } from "@/lib/generated/archive-api";

type ArchiveViewValue = NonNullable<components["schemas"]["ViewsExperienceSettings"]["archive"]>;
type FieldState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

// The archive table's actual data columns (see app/archive/page.tsx's
// archiveColumns) -- "select" and "actions" are structural chrome, never
// user-hideable, so they are intentionally not offered here.
const ARCHIVE_COLUMNS = ["title", "store", "type", "updated"] as const;
type ArchiveColumnId = (typeof ARCHIVE_COLUMNS)[number];

interface ViewCustomizationSectionProps {
  experience: ExperienceSettings;
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function ViewCustomizationSection({ experience, onUpdate }: Readonly<ViewCustomizationSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.viewCustomization;
  const { accessToken, status: authStatus } = useAuthSession();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [fieldState, setFieldState] = useState<FieldState>({ status: "idle" });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const archiveView = ((experience.views.value as { archive?: ArchiveViewValue } | undefined)?.archive ?? {}) as ArchiveViewValue;
  const visibleColumns = new Set<string>(archiveView.columns && archiveView.columns.length > 0 ? archiveView.columns : ARCHIVE_COLUMNS);
  const isEditable = experience.views.editable;
  const isSaving = fieldState.status === "saving";

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let cancelled = false;

    async function load() {
      const response = await api.savedSearches({ accessToken: accessToken ?? undefined });
      if (!cancelled && response.ok) setSavedSearches(response.searches);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, accessToken, authStatus]);

  async function commit(next: ArchiveViewValue) {
    setFieldState({ status: "saving" });
    const outcome = await onUpdate({ views: { archive: next } });

    if (!outcome.ok) {
      setFieldState({ status: "error", message: outcome.failure.message });
      return;
    }

    setFieldState({ status: "idle" });
  }

  function toggleColumn(column: ArchiveColumnId, show: boolean) {
    const next = new Set(visibleColumns);
    if (show) next.add(column);
    else next.delete(column);
    // "title" always stays -- an archive table with no title column is not
    // a usable table, so it is excluded from the toggle list entirely below
    // rather than allowed to be unchecked here.
    next.add("title");
    void commit({ ...archiveView, columns: Array.from(next) });
  }

  function setDefaultSavedSearch(id: string) {
    void commit({ ...archiveView, defaultSavedSearchId: id || null });
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-view-heading">
      <h3 id="settings-hub-view-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      {fieldState.status === "error" && (
        <p className="helper-text status-error" role="alert">
          {fieldState.message || copy.saveError}
        </p>
      )}

      <div className="section-divider">
        <strong>{copy.columnsHeading}</strong>
        <p className="helper-text mt-tight">{copy.titleColumnLockedNote}</p>
        <fieldset className="stack mt-tight">
          <legend className="ui-visually-hidden">{copy.columnsHeading}</legend>
          {ARCHIVE_COLUMNS.filter((column) => column !== "title").map((column) => (
            <label className="checkbox-label" key={column}>
              <input
                type="checkbox"
                checked={visibleColumns.has(column)}
                disabled={!isEditable || isSaving}
                onChange={(event) => toggleColumn(column, event.target.checked)}
              />
              {copy.columns[column]}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="section-divider">
        <strong>{copy.filtersHeading}</strong>
        <p className="helper-text mt-tight">{copy.filtersHint}</p>
        <select
          className="search-input mt-tight"
          aria-label={copy.filtersHeading}
          value={archiveView.defaultSavedSearchId ?? ""}
          disabled={!isEditable || isSaving}
          onChange={(event) => setDefaultSavedSearch(event.target.value)}
        >
          <option value="">{copy.filtersNone}</option>
          {savedSearches.map((search) => (
            <option key={search.id} value={search.id}>
              {search.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
