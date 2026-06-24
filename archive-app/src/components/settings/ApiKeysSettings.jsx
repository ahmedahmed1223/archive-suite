/**
 * ApiKeysSettings (§20.5)
 * Issue / list / revoke programmatic API keys. The plaintext key is shown
 * exactly once, right after creation — afterwards only the prefix is visible.
 */
import { useState, useEffect, useCallback, Fragment } from "react";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { getCloudToken } from "../../bootstrap/cloudSession.js";
import { useToast } from "../../hooks/useToast.js";

const SCOPE_OPTIONS = [
  { id: "read", label: "قراءة" },
  { id: "write", label: "كتابة" },
];

function authHeaders() {
  const token = getCloudToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ApiKeysSettings({ baseUrl = "", fetchImpl }) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const { showToast, ToastContainer } = useToast();

  const [keys, setKeys] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [createdKey, setCreatedKey] = useState(null); // one-time plaintext reveal
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!doFetch) return;
    try {
      const res = await doFetch(`${base}/api/api-keys`, { headers: authHeaders() });
      if (res.ok) setKeys((await res.json()).keys ?? []);
    } catch {
      // server may be unavailable (local mode) — leave the list empty
    }
  }, [base, doFetch]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const toggleScope = (id, checked) => {
    setScopes((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((s) => s !== id)));
  };

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await doFetch(`${base}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, scopes, expiresAt: expiresAt || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "فشل إنشاء المفتاح.");
      setCreatedKey(json.apiKey); // contains the one-time plaintext `key`
      setShowForm(false);
      setName("");
      setScopes(["read"]);
      setExpiresAt("");
      loadKeys();
    } catch (err) {
      showToast({ message: err?.message || "فشل إنشاء المفتاح.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [base, doFetch, name, scopes, expiresAt, loadKeys, showToast]);

  const handleRevoke = useCallback(async (id) => {
    try {
      const res = await doFetch(`${base}/api/api-keys/${encodeURIComponent(id)}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      showToast({ message: "أُبطل المفتاح", variant: "info" });
      loadKeys();
    } catch {
      showToast({ message: "تعذّر إبطال المفتاح", variant: "error" });
    }
  }, [base, doFetch, loadKeys, showToast]);

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ message: "تعذّر النسخ", variant: "error" });
    }
  }, [createdKey, showToast]);

  return (
    <Fragment>
    <section aria-labelledby="apikeys-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="apikeys-heading" className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-4 w-4" /> مفاتيح API
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> إنشاء مفتاح
        </button>
      </div>

      {createdKey && (
        <div role="alert" className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-200">
            انسخ المفتاح الآن — لن يظهر مرة أخرى:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-emerald-300">
              {createdKey.key}
            </code>
            <button
              type="button"
              onClick={copyKey}
              aria-label="نسخ المفتاح"
              className="shrink-0 rounded-lg border border-[var(--va-border)] p-2 hover:bg-white/10"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="text-xs text-gray-400 underline"
          >
            تم — إخفاء
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)] p-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المفتاح (مثل: تكامل WordPress)"
            className="w-full rounded-lg border border-[var(--va-border)] bg-[var(--va-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-emerald-500"
          />
          <div className="flex flex-wrap gap-3">
            {SCOPE_OPTIONS.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={scopes.includes(s.id)}
                  onChange={(e) => toggleScope(s.id, e.target.checked)}
                />
                {s.label}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-xs">
              انتهاء (اختياري):
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-lg border border-[var(--va-border)] bg-[var(--va-bg)] px-2 py-1 text-xs"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || scopes.length === 0 || !name.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              إنشاء
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--va-border)] px-4 py-1.5 text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {keys.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--va-text-muted)]">لا توجد مفاتيح API</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)] p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{k.name}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--va-text-muted)]">
                  {k.prefix}… · {(k.scopes || []).join(", ")}
                  {k.expiresAt ? ` · ينتهي ${String(k.expiresAt).slice(0, 10)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(k.id)}
                aria-label={`إبطال ${k.name}`}
                className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
    <ToastContainer />
    </Fragment>
  );
}
