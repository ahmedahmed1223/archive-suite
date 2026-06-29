// Auth routes — login, logout, refresh, register, password-reset, TOTP, me.
// Extracted from api/server.js. No business logic changed.

import { signJwt, verifyJwt } from "../auth/jwt.js";
import { revokeToken } from "../auth/tokenBlacklist.js";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshFamily,
  peekRefreshFamily,
} from "../auth/refreshTokenStore.js";
import {
  generateTotpSecret,
  verifyTotpToken,
  generateRecoveryCodes,
  verifyRecoveryCode,
} from "../auth/totpService.js";
import { sendPasswordResetEmail } from "../auth/emailService.js";
import { createResetToken, consumeResetToken } from "../auth/resetTokenStore.js";
import { logger, createLogger } from "../logger.js";
import { config } from "../config/env.js";
import bcrypt from "bcryptjs";

const authLog = createLogger("auth");

// ── Refresh-token cookie ──────────────────────────────────────────────────────
const REFRESH_COOKIE = "va_refresh";

function parseCookies(req: any): Record<string, string> {
  const out: Record<string, string> = {};
  const header = String(req.headers?.cookie || "");
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function isSecureRequest(req: any): boolean {
  if (req.socket?.encrypted) return true;
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function refreshCookieHeader(req: any, token: string, maxAgeSec: number): string {
  const attrs = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/auth",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];
  if (isSecureRequest(req)) attrs.push("Secure");
  return attrs.join("; ");
}

function clearRefreshCookieHeader(req: any): string {
  return refreshCookieHeader(req, "", 0);
}

function requestOrigin(req: any): string {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

/**
 * Handles all /api/auth/* routes.
 * Returns true if the request was handled, false if it should fall through.
 */
export async function handleAuthRoute({
  req,
  res,
  url,
  send,
  overLimit,
  readJsonBody,
  requireAuthClaims,
  resolveStorage,
  resolvedAuthSecret,
  refreshExpiresInSec,
  login,
  authRequired,
  bearerToken,
  clientIp,
}: any): Promise<boolean> {
  // GET /api/auth/me
  if (req.method === "GET" && url === "/api/auth/me") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const user = await resolveStorage().get("users", claims.sub);
      if (!user) return send(res, 404, { ok: false, error: "User not found." }), true;
      return (
        send(res, 200, {
          ok: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role || "editor",
            totpEnabled: !!user.totpEnabled,
            totpRecoveryCodesRemaining: user.totpRecoveryCodes?.length ?? 0,
          },
        }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed." }), true;
    }
  }

  // POST /api/auth/register
  if (req.method === "POST" && url === "/api/auth/register") {
    if (overLimit(res, "login", req)) return true;
    try {
      const body = await readJsonBody(req);
      const { username, email = "", password } = body || {};
      if (!username || typeof username !== "string" || username.trim().length < 3) {
        return send(res, 400, { ok: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل." }), true;
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return send(res, 400, { ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." }), true;
      }
      const storage = resolveStorage();
      const existingUsers = await storage.getAll("users").catch(() => []);
      if (existingUsers.length > 0) {
        return send(res, 403, { ok: false, error: "التسجيل مغلق — يرجى تسجيل الدخول." }), true;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const stamp = new Date().toISOString();
      const newUser = {
        id: `user_${Date.now().toString(36)}`,
        username: username.trim().slice(0, 50),
        email: String(email || "").trim().slice(0, 200),
        displayName: username.trim().slice(0, 50),
        role: "admin",
        isActive: true,
        passwordHash,
        createdAt: stamp,
        updatedAt: stamp,
      };
      await storage.put("users", newUser);
      authLog.info(
        { event: "register", username: newUser.username, ip: clientIp(req) },
        "AUDIT: first-run admin registered"
      );
      if (!resolvedAuthSecret) {
        return (
          send(res, 201, { ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } }),
          true
        );
      }
      const token = signJwt(
        { sub: newUser.id, username: newUser.username, role: newUser.role },
        resolvedAuthSecret
      );
      return (
        send(res, 201, { ok: true, token, user: { id: newUser.id, username: newUser.username, role: newUser.role } }),
        true
      );
    } catch (err) {
      logger.error({ err }, "register failed");
      return send(res, 500, { ok: false, error: "فشل إنشاء الحساب." }), true;
    }
  }

  // POST /api/auth/login
  if (req.method === "POST" && url === "/api/auth/login") {
    if (overLimit(res, "login", req)) return true;
    if (typeof login !== "function") {
      return send(res, 501, { ok: false, error: "Login not configured on this server." }), true;
    }
    try {
      const body = await readJsonBody(req);
      const { username } = body || {};
      const result = await login(body);
      authLog.info({ event: "login", username, ip: clientIp(req) }, "AUDIT: login success");
      if (resolvedAuthSecret && result?.user?.id) {
        const refresh = issueRefreshToken(
          { sub: result.user.id, username: result.user.username, role: result.user.role },
          resolvedAuthSecret,
          { expiresInSec: refreshExpiresInSec }
        );
        res.setHeader("Set-Cookie", refreshCookieHeader(req, refresh.token, refresh.expiresInSec));
      }
      return send(res, 200, { ok: true, ...result }), true;
    } catch (error: any) {
      const statusCode = error?.statusCode || 500;
      return send(res, statusCode, { ok: false, error: error?.message || "Login failed" }), true;
    }
  }

  // POST /api/auth/refresh
  if (req.method === "POST" && url === "/api/auth/refresh") {
    if (overLimit(res, "login", req)) return true;
    if (!authRequired) return send(res, 501, { ok: false, error: "Auth is not configured on this server." }), true;
    const presented = parseCookies(req)[REFRESH_COOKIE];
    if (!presented) return send(res, 401, { ok: false, error: "لا توجد بطاقة تجديد." }), true;
    try {
      const { token: nextRefresh, claims } = rotateRefreshToken(presented, resolvedAuthSecret, {
        expiresInSec: refreshExpiresInSec,
      });
      const accessToken = signJwt(
        { sub: claims.sub, username: claims.username, role: claims.role },
        resolvedAuthSecret
      );
      res.setHeader("Set-Cookie", refreshCookieHeader(req, nextRefresh, refreshExpiresInSec));
      authLog.info(
        { event: "refresh", sub: claims.sub, username: claims.username, ip: clientIp(req) },
        "AUDIT: token refreshed"
      );
      return (
        send(res, 200, { ok: true, token: accessToken, user: { id: claims.sub, username: claims.username, role: claims.role } }),
        true
      );
    } catch (error: any) {
      res.setHeader("Set-Cookie", clearRefreshCookieHeader(req));
      if (error?.code === "REFRESH_REUSED") {
        authLog.warn({ event: "refresh_reuse", ip: clientIp(req) }, "AUDIT: refresh token reuse detected");
      }
      return send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Refresh failed" }), true;
    }
  }

  // POST /api/auth/logout
  if (req.method === "POST" && url === "/api/auth/logout") {
    if (!authRequired) return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." }), true;
    const cookies = parseCookies(req);
    const presentedRefresh = cookies[REFRESH_COOKIE];
    if (presentedRefresh) {
      const family = peekRefreshFamily(presentedRefresh);
      if (family) revokeRefreshFamily(family);
    }
    res.setHeader("Set-Cookie", clearRefreshCookieHeader(req));
    const token = bearerToken(req);
    if (!token) return send(res, 401, { ok: false, error: "Authentication required." }), true;
    try {
      const claims = verifyJwt(token, resolvedAuthSecret);
      if (claims?.jti) revokeToken(claims.jti, claims.exp);
      authLog.info(
        { event: "logout", sub: claims?.sub, username: claims?.username, ip: clientIp(req) },
        "AUDIT: logout"
      );
      return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." }), true;
    } catch (error: any) {
      if (error?.code === "TOKEN_REVOKED" || error?.statusCode === 401) {
        return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." }), true;
      }
      return send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Logout failed" }), true;
    }
  }

  // POST /api/auth/request-reset
  if (req.method === "POST" && url === "/api/auth/request-reset") {
    if (overLimit(res, "reset", req)) return true;
    try {
      const body = await readJsonBody(req);
      const { username } = body;
      const users = await resolveStorage().getAll("users").catch(() => []);
      const user = users.find(
        (u: any) =>
          u.username?.toLowerCase() === String(username || "").toLowerCase() && u.isActive !== false
      );
      if (user && user.email) {
        const token = createResetToken(user.id, user.username, user.email);
        const baseUrl = config.appBaseUrl || `${requestOrigin(req)}`;
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;
        await sendPasswordResetEmail({ to: user.email, resetUrl, username: user.username });
      }
      return (
        send(res, 200, {
          ok: true,
          message: "إذا كان البريد الإلكتروني مسجلاً، ستصل رسالة خلال دقائق.",
        }),
        true
      );
    } catch (error: any) {
      logger.warn({ err: error?.message }, "request-reset error");
      return (
        send(res, 200, {
          ok: true,
          message: "إذا كان البريد الإلكتروني مسجلاً، ستصل رسالة خلال دقائق.",
        }),
        true
      );
    }
  }

  // POST /api/auth/reset-password
  if (req.method === "POST" && url === "/api/auth/reset-password") {
    if (overLimit(res, "reset", req)) return true;
    try {
      const body = await readJsonBody(req);
      const { token, newPassword } = body;
      if (!token || !newPassword || newPassword.length < 8) {
        return (
          send(res, 400, {
            ok: false,
            error: "البيانات غير صالحة. كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
          }),
          true
        );
      }
      const data = consumeResetToken(token);
      if (!data) {
        return send(res, 400, { ok: false, error: "رمز إعادة التعيين غير صالح أو منتهي الصلاحية." }), true;
      }
      const storage = resolveStorage();
      const existingUser = await storage.get("users", data.userId);
      if (!existingUser) return send(res, 400, { ok: false, error: "المستخدم غير موجود." }), true;
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await storage.put("users", { ...existingUser, passwordHash, updatedAt: new Date().toISOString() });
      return (
        send(res, 200, { ok: true, message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن." }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Password reset failed" }), true;
    }
  }

  // POST /api/auth/totp/setup
  if (req.method === "POST" && url === "/api/auth/totp/setup") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const { secret, otpauthUrl, qrUrl } = await generateTotpSecret(claims.username);
      await resolveStorage().put("users", { id: claims.sub, totpSecretPending: secret });
      return (
        send(res, 200, {
          ok: true,
          otpauthUrl,
          qrUrl,
          message: "امسح رمز QR بتطبيق المصادقة ثم أدخل الرمز للتأكيد.",
        }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP setup failed" }), true;
    }
  }

  // POST /api/auth/totp/verify
  if (req.method === "POST" && url === "/api/auth/totp/verify") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const { token: totpCode } = await readJsonBody(req);
      const user = await resolveStorage().get("users", claims.sub);
      if (!user?.totpSecretPending) {
        return send(res, 400, { ok: false, error: "لا يوجد إعداد 2FA معلّق." }), true;
      }
      if (!verifyTotpToken(user.totpSecretPending, totpCode)) {
        return send(res, 400, { ok: false, error: "رمز التحقق غير صحيح." }), true;
      }
      const { plain: recoveryCodes, hashes: recoveryHashes } = await generateRecoveryCodes(8);
      await resolveStorage().put("users", {
        id: claims.sub,
        totpSecret: user.totpSecretPending,
        totpSecretPending: null,
        totpEnabled: true,
        totpRecoveryCodes: recoveryHashes,
      });
      return (
        send(res, 200, {
          ok: true,
          recoveryCodes,
          message: "تم تفعيل المصادقة الثنائية بنجاح. احفظ رموز الاسترداد في مكان آمن.",
        }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP verify failed" }), true;
    }
  }

  // DELETE /api/auth/totp
  if (req.method === "DELETE" && url === "/api/auth/totp") {
    if (overLimit(res, "totpDisable", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const { token: totpCode } = await readJsonBody(req);
      const user = await resolveStorage().get("users", claims.sub);
      if (user?.totpEnabled && !verifyTotpToken(user.totpSecret, totpCode)) {
        return (
          send(res, 400, {
            ok: false,
            error: "رمز التحقق غير صحيح. أدخل الرمز الحالي لتعطيل 2FA.",
          }),
          true
        );
      }
      await resolveStorage().put("users", {
        id: claims.sub,
        totpSecret: null,
        totpSecretPending: null,
        totpEnabled: false,
        totpRecoveryCodes: null,
      });
      return send(res, 200, { ok: true, message: "تم تعطيل المصادقة الثنائية." }), true;
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP disable failed" }), true;
    }
  }

  // POST /api/auth/totp/recover
  if (req.method === "POST" && url === "/api/auth/totp/recover") {
    if (overLimit(res, "totpDisable", req)) return true;
    try {
      const { username, password, recoveryCode } = await readJsonBody(req);
      if (!username || !password || !recoveryCode) {
        return send(res, 400, { ok: false, error: "username و password و recoveryCode مطلوبة." }), true;
      }
      const storage = resolveStorage();
      const wantedUsername = String(username || "").trim().toLowerCase();
      let user: any;
      if (typeof storage.getByField === "function") {
        const found = await storage.getByField("users", "username", wantedUsername).catch(() => undefined);
        user = found?.isActive !== false ? found : undefined;
      } else {
        const users = await storage.getAll("users").catch(() => []);
        user = (users || []).find(
          (u: any) =>
            String(u?.username || "").trim().toLowerCase() === wantedUsername && u?.isActive !== false
        );
      }
      const { verifySecret } = await import("../auth/authService.js");
      const hash =
        user?.passwordHash || "$2a$12$0000000000000000000000000000000000000000000000000000";
      const passwordOk = await verifySecret(password, hash);
      if (!user || !passwordOk) {
        return send(res, 401, { ok: false, error: "بيانات الدخول غير صحيحة." }), true;
      }
      if (!user.totpEnabled || !user.totpRecoveryCodes?.length) {
        return send(res, 400, { ok: false, error: "لا توجد رموز استرداد لهذا الحساب." }), true;
      }
      const matchIndex = await verifyRecoveryCode(recoveryCode, user.totpRecoveryCodes);
      if (matchIndex === -1) {
        return send(res, 401, { ok: false, error: "رمز الاسترداد غير صحيح." }), true;
      }
      const remainingCodes = user.totpRecoveryCodes.filter((_: any, i: number) => i !== matchIndex);
      await storage.put("users", { id: user.id, totpRecoveryCodes: remainingCodes });
      const { signJwt: sign } = await import("../auth/jwt.js");
      if (!resolvedAuthSecret) return send(res, 500, { ok: false, error: "Server misconfigured." }), true;
      const claims = { sub: user.id, username: user.username, role: user.role || "editor" };
      const token = sign(claims, resolvedAuthSecret, { expiresInSec: refreshExpiresInSec });
      return (
        send(res, 200, {
          ok: true,
          token,
          user: { id: user.id, username: user.username, role: claims.role },
          remainingRecoveryCodes: remainingCodes.length,
          message:
            remainingCodes.length === 0
              ? "تم استخدام آخر رمز استرداد. يُنصح بتعطيل 2FA وإعادة تفعيله لتوليد رموز جديدة."
              : undefined,
        }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Recovery failed" }), true;
    }
  }

  return false; // not handled
}
