import { useState, useEffect, useCallback } from "react";
import { appConfirm } from "../common/ConfirmDialog.js";

export function BackupManager({ authToken }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState(null);
  // Restore flow: which backup row is being restored + its passphrase (for .enc).
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [passphrase, setPassphrase] = useState("");
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/backups", { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) setBackups((await r.json()).backups ?? []);
    } catch { setMsg({ err: true, text: "فشل تحميل النسخ الاحتياطية" }); }
    finally { setLoading(false); }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const trigger = async () => {
    setTriggering(true);
    try {
      const r = await fetch("/api/admin/backups/run", { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      const d = await r.json();
      setMsg({ err: !r.ok, text: d.message ?? (r.ok ? "جاري تشغيل النسخة الاحتياطية" : "فشل") });
      if (r.ok) setTimeout(load, 4000);
    } catch { setMsg({ err: true, text: "فشل الاتصال بالخادم" }); }
    finally { setTriggering(false); }
  };

  const startRestore = (backup) => {
    setMsg(null);
    setPassphrase("");
    setRestoreTarget(backup);
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    if (restoreTarget.encrypted && !passphrase) {
      setMsg({ err: true, text: "هذه النسخة مشفّرة — أدخل كلمة مرور التشفير أولاً." });
      return;
    }
    const confirmed = await appConfirm(
      `ستحلّ بيانات النسخة «${restoreTarget.filename}» محل كل بيانات الأرشيف الحالية. لا يمكن التراجع عن هذه العملية. هل أنت متأكد؟`,
      { title: "استعادة نسخة احتياطية", kind: "danger", confirmLabel: "استعادة الآن" }
    );
    if (!confirmed) return;
    setRestoring(true);
    try {
      const r = await fetch("/api/admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ filename: restoreTarget.filename, passphrase })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ err: false, text: "تمت الاستعادة بنجاح. أعد تحميل الصفحة لرؤية البيانات المستعادة." });
        setRestoreTarget(null);
      } else {
        setMsg({ err: true, text: d.error || "فشلت الاستعادة." });
      }
    } catch {
      setMsg({ err: true, text: "فشل الاتصال بالخادم أثناء الاستعادة." });
    } finally {
      setPassphrase("");
      setRestoring(false);
    }
  };

  const fmt = bytes => bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)}KB` : `${(bytes/1048576).toFixed(2)}MB`;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">النسخ الاحتياطية</h2>
        <button onClick={trigger} disabled={triggering}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors">
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
            <div key={b.filename} className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-mono text-gray-200 truncate" dir="ltr">{b.filename}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(b.createdAt).toLocaleString("ar")} · {fmt(b.sizeBytes)}
                    {b.encrypted && <span className="mr-2 text-amber-400">🔒 مشفّرة</span>}
                  </p>
                </div>
                <button
                  onClick={() => (restoreTarget?.filename === b.filename ? setRestoreTarget(null) : startRestore(b))}
                  className="shrink-0 px-2.5 py-1 text-xs rounded-lg border border-amber-600/50 text-amber-300 hover:bg-amber-900/30 transition-colors"
                >
                  {restoreTarget?.filename === b.filename ? "إلغاء" : "استعادة"}
                </button>
              </div>
              {restoreTarget?.filename === b.filename && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-700/50">
                  {b.encrypted && (
                    <input
                      type="password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="كلمة مرور التشفير"
                      autoComplete="off"
                      className="flex-1 min-w-40 px-2.5 py-1.5 text-xs bg-gray-900/70 border border-gray-700 rounded-lg text-gray-200 outline-none focus:border-amber-500/50"
                    />
                  )}
                  <button
                    onClick={doRestore}
                    disabled={restoring || (b.encrypted && !passphrase)}
                    className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {restoring ? "جاري الاستعادة..." : "تأكيد الاستعادة"}
                  </button>
                  <p className="w-full text-[11px] text-amber-200/70">
                    ⚠️ الاستعادة تستبدل كل البيانات الحالية بمحتوى هذه النسخة بعد التحقق من سلامتها (SHA-256).
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
