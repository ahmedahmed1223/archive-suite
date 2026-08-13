"use client";

import { ChevronLeft, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface DropboxFolderPickerProps {
  currentFolderPath: string | null;
  onSelected: (folderPath: string) => void;
}

/** V1-762: lets an admin browse real Dropbox subfolders instead of typing a
 * raw path. Only folders are listed -- the backend already filters files out
 * (DropboxConnectionService::browseFolders). */
export default function DropboxFolderPicker({ currentFolderPath, onSelected }: DropboxFolderPickerProps) {
  const { t, locale } = useLocale();
  const copy = t.settings.dropboxFolderPicker;
  const ParentFolderIcon = locale === "en" ? ChevronLeft : ChevronRight;
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(currentFolderPath || "/");
  const [folders, setFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function browse(nextPath: string) {
    setLoading(true);
    setError("");
    const response = await createArchiveApiClient().browseDropboxFolders(nextPath);
    if (response.ok) {
      setPath(nextPath);
      setFolders(response.folders);
    } else {
      setError(response.error);
    }
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    void browse(currentFolderPath || "/");
  }

  async function chooseCurrentFolder() {
    setSaving(true);
    setError("");
    const response = await createArchiveApiClient().setDropboxFolder(path);
    setSaving(false);
    if (response.ok) {
      onSelected(path);
      setOpen(false);
    } else {
      setError(response.error);
    }
  }

  function parentOf(currentPath: string) {
    const segments = currentPath.split("/").filter(Boolean);
    return "/" + segments.slice(0, -1).join("/");
  }

  return (
    <div className="dropbox-folder-picker">
      <button type="button" className="button button-secondary button-sm" onClick={handleOpen}>
        <Folder size={16} aria-hidden="true" />
        {copy.chooseFolder}
      </button>

      {open ? (
        <div className="panel panel-compact" role="dialog" aria-label={copy.dialogAriaLabel}>
          <div className="panel-title-row">
            <h3>{copy.browseTitle.replace("{path}", path)}</h3>
            <button type="button" className="button button-secondary button-sm" onClick={() => setOpen(false)}>
              {copy.close}
            </button>
          </div>
          {loading ? <p className="helper-text" role="status">{copy.loading}</p> : null}
          {error ? <p className="form-status status-error" role="alert">{error}</p> : null}
          {!loading ? (
            <ul className="stack-list" aria-label={copy.subfoldersAriaLabel}>
              {path !== "/" ? (
                <li>
                  <button type="button" className="text-accent" onClick={() => void browse(parentOf(path))}>
                    <ParentFolderIcon size={16} aria-hidden="true" />
                    {copy.parentFolder}
                  </button>
                </li>
              ) : null}
              {folders.map((folder) => (
                <li key={folder.path} className="panel-title-row">
                  <span>
                    <FolderOpen size={18} aria-hidden="true" />
                    {folder.name}
                  </span>
                  <button type="button" className="button button-secondary button-sm" onClick={() => void browse(folder.path)}>
                    {copy.open}
                  </button>
                </li>
              ))}
              {folders.length === 0 ? <li className="helper-text">{copy.empty}</li> : null}
            </ul>
          ) : null}
          <div className="button-row">
            <button type="button" className="button button-primary button-sm" disabled={saving} onClick={() => void chooseCurrentFolder()}>
              {saving ? copy.saving : copy.chooseCurrent.replace("{path}", path)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
