function failure(message) {
  return { ok: false, checkedRoles: [], message };
}

export function createRoleSmoke({ baseUrl, accessToken, fetchImpl = fetch } = {}) {
  return async function runRoleSmoke() {
    if (typeof baseUrl !== "string" || !baseUrl || typeof accessToken !== "string" || !accessToken) {
      return failure("A configured authenticated smoke identity is required before a release update can proceed.");
    }
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/v1/auth/me`;
    try {
      const anonymous = await fetchImpl(endpoint, { signal: AbortSignal.timeout(5000) });
      if (anonymous.status !== 401 && anonymous.status !== 403) return failure("The anonymous access boundary did not deny a protected endpoint.");
      const authenticated = await fetchImpl(endpoint, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) });
      const payload = await authenticated.json().catch(() => null);
      if (!authenticated.ok || payload?.ok !== true || !payload?.user?.role) return failure("The configured authenticated smoke identity was not accepted by the protected endpoint.");
      return { ok: true, checkedRoles: ["anonymous-denied", "authenticated-accepted"], message: "Role access smoke passed." };
    } catch {
      return failure("Could not complete the role access smoke check.");
    }
  };
}
