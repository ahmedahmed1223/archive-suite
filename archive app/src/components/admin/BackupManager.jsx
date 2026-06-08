import { useState, useEffect, useCallback } from "react";

export function BackupManager({ authToken }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState(null);

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
            <div key={b.filename} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-sm font-mono text-gray-200">{b.filename}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(b.createdAt).toLocaleString("ar")} · {fmt(b.sizeBytes)}
                </p>
              </div>
              <span className="text-xs text-emerald-500">✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
