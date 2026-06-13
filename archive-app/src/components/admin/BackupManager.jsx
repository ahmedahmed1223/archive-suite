import { useState, useEffect, useCallback, useRef } from "react";
import { appConfirm } from "../common/ConfirmDialog.js";

const STORE_LABELS = {
  videoItems: "مقاطع الفيديو",
  contentTypes: "أنواع المحتوى",
  bookmarks: "الإشارات المرجعية",
  relations: "العلاقات",
  virtualCollections: "المجموعات الافتراضية",
  vocabulary: "المفردات",
  hierarchicalTags: "الوسوم الهرمية",
  changeHistory: "سجل التغييرات",
  auditLogs: "سجلات المراجعة",
  projects: "المشاريع",
  users: "المستخدمون",
};

const CONFIRM_WORD = "استعادة";

function fmt(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(2)}MB`;
}

function StoreCheckbox({ domainKey, count, checked, onChange }) {
  const label = STORE_LABELS[domainKey] || domainKey;
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2 hover:border-gray-600/60 hover:bg-gray-800/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(domainKey, e.target.checked)}
        className="accent-emerald-500"
      />
      <span className="flex-1 text-sm text-gray-200">{label}</span>
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300" dir="ltr">
        {count}
      </span>
    </label>
  );
}

export function BackupManager({ authToken }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState(null);

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [passphrase, setPassphrase] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedStores, setSelectedStores] = useState({});
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const confirmInputRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${authToken}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/backups", { headers: authHeaders });
      if (r.ok) setBackups((await r.json()).backups ?? []);
    } catch {
      setMsg({ err: true, text: "فشل تحميل النسخ الاحتياطية" });
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const trigger = async () => {
    setTriggering(true);
    try {
      const r = await fetch("/api/admin/backups/run", { method: "POST", headers: authHeaders });
      const d = await r.json();
      setMsg({ err: !r.ok, text: d.message ?? (r.ok ? "جاري تشغيل النسخة الاحتياطية" : "فشل") });
      if (r.ok) setTimeout(load, 4000);
    } catch {
      setMsg({ err: true, text: "فشل الاتصال بالخادم" });
    } finally {
      setTriggering(false);
    }
  };

  const openRestore = (backup) => {
    setMsg(null);
    setPassphrase("");
    setPreviewData(null);
    setSelectedStores({});
    setConfirmText("");
    setRestoreTarget(backup);
  };

  const closeRestore = () => {
    setRestoreTarget(null);
    setPassphrase("");
    setPreviewData(null);
    setSelectedStores({});
    setConfirmText("");
  };

  const loadPreview = async () => {
    if (!restoreTarget) return;
    setPreviewLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/backups/preview", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: restoreTarget.filename, passphrase })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.stores) {
        setPreviewData(d);
        const all = {};
        for (const key of Object.keys(d.stores)) { all[key] = true; }
        setSelectedStores(all);
        setConfirmText("");
        setTimeout(() => confirmInputRef.current?.focus(), 100);
      } else {
        setMsg({ err: true, text: d.error || "فشل تحميل معاينة النسخة." });
      }
    } catch {
      setMsg({ err: true, text: "فشل الاتصال بالخادم." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleStore = (key, checked) => {
    setSelectedStores(prev => ({ ...prev, [key]: checked }));
    setConfirmText("");
  };

  const toggleAll = (checked) => {
    if (!previewData) return;
    const all = {};
    for (const key of Object.keys(previewData.stores)) { all[key] = checked; }
    setSelectedStores(all);
    setConfirmText("");
  };

  const selectedKeys = previewData
    ? Object.keys(previewData.stores).filter(k => selectedStores[k])
    : [];
  const allSelected = previewData && selectedKeys.length === Object.keys(previewData.stores).length;
  const noneSelected = selectedKeys.length === 0;
  const isFullRestore = allSelected;
  const confirmReady = confirmText.trim() === CONFIRM_WORD && !noneSelected;

  const doRestore = async () => {
    if (!restoreTarget || !confirmReady) return;
    const scopeLabel = isFullRestore
      ? "كل البيانات"
      : `المخازن: ${selectedKeys.map(k => STORE_LABELS[k] || k).join("، ")}`;
    const confirmed = await appConfirm(
      `ستحلّ بيانات النسخة «${restoreTarget.filename}» محل ${scopeLabel} الحالية. لا يمكن التراجع عن هذه العملية. هل أنت متأكد؟`,
      { title: "تأكيد الاستعادة", kind: "danger", confirmLabel: "استعادة الآن" }
    );
    if (!confirmed) return;

    setRestoring(true);
    try {
      const r = await fetch("/api/admin/backups/restore", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: restoreTarget.filename,
          passphrase,
          stores: isFullRestore ? undefined : selectedKeys
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ err: false, text: "تمت الاستعادة بنجاح. أعد تحميل الصفحة لرؤية البيانات المستعادة." });
        closeRestore();
      } else {
        setMsg({ err: true, text: d.error || "فشلت الاستعادة." });
      }
    } catch {
      setMsg({ err: true, text: "فشل الاتصال بالخادم أثناء الاستعادة." });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">النسخ الاحتياطية</h2>
        <button
          onClick={trigger}
          disabled={triggering}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {triggering ? "جاري..." : "نسخ الآن"}
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.err ? "bg-red-900/30 text-red-300 border border-red-700/50" : "bg-emerald-900/30 text-emerald-300 border border-emerald-700/50"}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm animate-pulse">جاري التحميل...</p>
      ) : backups.length === 0 ? (
        <p className="text-gray-500 text-sm">لا توجد نسخ احتياطية بعد.</p>
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <div key={b.filename} className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-mono text-gray-200 truncate" dir="ltr">{b.filename}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(b.createdAt).toLocaleString("ar")} · {fmt(b.sizeBytes)}
                    {b.encrypted && <span className="mr-2 text-amber-400">🔒 مشفّرة</span>}
                  </p>
                </div>
                <button
                  onClick={() => (restoreTarget?.filename === b.filename ? closeRestore() : openRestore(b))}
                  className="shrink-0 px-2.5 py-1 text-xs rounded-lg border border-amber-600/50 text-amber-300 hover:bg-amber-900/30 transition-colors"
                >
                  {restoreTarget?.filename === b.filename ? "إلغاء" : "استعادة"}
                </button>
              </div>

              {restoreTarget?.filename === b.filename && (
                <div className="space-y-3 border-t border-gray-700/50 pt-3">

                  {!previewData && (
                    <div className="flex flex-wrap items-center gap-2">
                      {b.encrypted && (
                        <input
                          type="password"
                          value={passphrase}
                          onChange={e => setPassphrase(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") loadPreview(); }}
                          placeholder="كلمة مرور التشفير"
                          autoComplete="off"
                          className="flex-1 min-w-40 px-2.5 py-1.5 text-xs bg-gray-900/70 border border-gray-700 rounded-lg text-gray-200 outline-none focus:border-amber-500/50"
                        />
                      )}
                      <button
                        onClick={loadPreview}
                        disabled={previewLoading || (b.encrypted && !passphrase)}
                        className="px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {previewLoading ? "جاري التحميل..." : "معاينة المحتوى"}
                      </button>
                    </div>
                  )}

                  {previewData && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-300">اختر المخازن للاستعادة</p>
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
                          <input
                            type="checkbox"
                            checked={!!allSelected}
                            onChange={e => toggleAll(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          تحديد الكل
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {Object.entries(previewData.stores).map(([key, count]) => (
                          <StoreCheckbox
                            key={key}
                            domainKey={key}
                            count={count}
                            checked={!!selectedStores[key]}
                            onChange={toggleStore}
                          />
                        ))}
                      </div>

                      {!noneSelected && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-xs text-amber-200/80">
                            ⚠️ اكتب{" "}
                            <span className="font-mono font-bold text-amber-300">{CONFIRM_WORD}</span>{" "}
                            للمتابعة
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              ref={confirmInputRef}
                              type="text"
                              value={confirmText}
                              onChange={e => setConfirmText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && confirmReady) doRestore(); }}
                              placeholder={CONFIRM_WORD}
                              autoComplete="off"
                              dir="rtl"
                              className="flex-1 min-w-32 px-2.5 py-1.5 text-xs bg-gray-900/70 border border-gray-700 rounded-lg text-gray-200 outline-none focus:border-amber-500/50"
                            />
                            <button
                              onClick={doRestore}
                              disabled={restoring || !confirmReady}
                              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                              {restoring
                                ? "جاري الاستعادة..."
                                : isFullRestore
                                  ? "استعادة كاملة"
                                  : `استعادة ${selectedKeys.length} مخزن`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
