import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { getCloudToken } from "../../bootstrap/cloudSession.js";

async function apiFetch(path, options = {}) {
  const token = getCloudToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(path, { ...options, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={copy} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="نسخ">
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export function TwoFactorSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Setup flow
  const [setupPhase, setSetupPhase] = useState("idle"); // idle | qr | codes | done
  const [qrUrl, setQrUrl] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  // Disable flow
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/me");
      setProfile(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSetup() {
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/totp/setup", { method: "POST" });
      setQrUrl(data.qrUrl);
      setOtpauthUrl(data.otpauthUrl);
      setSetupPhase("qr");
      setVerifyCode("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!verifyCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/totp/verify", {
        method: "POST",
        body: JSON.stringify({ token: verifyCode.trim() }),
      });
      setRecoveryCodes(data.recoveryCodes || []);
      setSetupPhase("codes");
      await loadProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!disableCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/totp", {
        method: "DELETE",
        body: JSON.stringify({ token: disableCode.trim() }),
      });
      setShowDisable(false);
      setDisableCode("");
      setSetupPhase("idle");
      await loadProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadCodes() {
    const text = recoveryCodes.join("\n");
    const a = document.createElement("a");
    a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    a.download = "archive-suite-recovery-codes.txt";
    a.click();
  }

  if (loading) return <p className="text-sm text-gray-400 animate-pulse">جاري التحميل...</p>;

  const isEnabled = !!profile?.totpEnabled;

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Status badge */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${isEnabled ? "border-green-500/30 bg-green-500/10" : "border-white/10 bg-white/[0.03]"}`}>
        {isEnabled
          ? <ShieldCheck className="h-6 w-6 shrink-0 text-green-400" />
          : <ShieldOff className="h-6 w-6 shrink-0 text-gray-500" />
        }
        <div>
          <p className="text-sm font-semibold text-white">
            {isEnabled ? "المصادقة الثنائية مُفعَّلة" : "المصادقة الثنائية معطلة"}
          </p>
          {isEnabled && (
            <p className="mt-0.5 text-xs text-gray-400">
              رموز الاسترداد المتبقية: {profile.totpRecoveryCodesRemaining ?? 0}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="alert alert-error block rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {/* ── Setup: initiate ── */}
      {!isEnabled && setupPhase === "idle" && (
        <button
          type="button"
          onClick={handleSetup}
          disabled={busy}
          className="va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {busy ? "جاري الإعداد..." : "تفعيل المصادقة الثنائية (2FA)"}
        </button>
      )}

      {/* ── Setup: scan QR ── */}
      {setupPhase === "qr" && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-gray-300">
            امسح رمز QR بتطبيق المصادقة (Google Authenticator، Authy، …) ثم أدخل الرمز المكوّن من 6 أرقام لتأكيد الإعداد.
          </p>
          {qrUrl && (
            <div className="flex justify-center">
              <img src={qrUrl} alt="رمز QR للمصادقة الثنائية" className="h-44 w-44 rounded-lg bg-white p-2" />
            </div>
          )}
          {otpauthUrl && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-300">إظهار الرابط النصي</summary>
              <p className="mt-1 break-all rounded-lg bg-black/30 p-2 font-mono text-gray-400 select-all">{otpauthUrl}</p>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="w-32 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center font-mono text-lg tracking-widest text-white outline-none focus:border-white/30"
              aria-label="رمز التحقق"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || verifyCode.length < 6}
              className="va-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "جاري التحقق..." : "تأكيد"}
            </button>
            <button
              type="button"
              onClick={() => { setSetupPhase("idle"); setError(""); setVerifyCode(""); }}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-400 hover:bg-white/5"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── Setup: show recovery codes ── */}
      {setupPhase === "codes" && (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-300">
            احفظ رموز الاسترداد التالية في مكان آمن — لن تظهر مرة أخرى.
          </p>
          <p className="text-xs text-gray-400">
            كل رمز يُستخدم مرة واحدة فقط للدخول عند فقدان الجهاز. عندك {recoveryCodes.length} رموز.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <div key={code} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-1.5">
                <span className="select-all font-mono text-sm text-white">{code}</span>
                <CopyButton text={code} />
              </div>
            ))}
          </div>
          <button type="button" onClick={downloadCodes} className="text-xs va-accent-text hover:underline">
            تحميل كملف نصي
          </button>
          <button
            type="button"
            onClick={() => setSetupPhase("done")}
            className="mt-2 block va-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            لقد حفظت الرموز ✓
          </button>
        </div>
      )}

      {/* ── Disable: trigger ── */}
      {isEnabled && !showDisable && (
        <button
          type="button"
          onClick={() => setShowDisable(true)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
        >
          تعطيل المصادقة الثنائية
        </button>
      )}

      {/* ── Disable: confirm with code ── */}
      {isEnabled && showDisable && (
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">
            أدخل رمز التطبيق الحالي (أو رمز استرداد) لتأكيد التعطيل:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={24}
              placeholder="000000 أو XXXXX-XXXXX-…"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="w-56 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/30"
              aria-label="رمز التحقق لتعطيل 2FA"
            />
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy || !disableCode.trim()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "جاري..." : "تعطيل"}
            </button>
            <button
              type="button"
              onClick={() => { setShowDisable(false); setDisableCode(""); setError(""); }}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-400 hover:bg-white/5"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TwoFactorSettings;
