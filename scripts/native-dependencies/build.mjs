function normalizedMembers(members) {
  if (!Array.isArray(members)) throw new Error("Archive members must be an array.");
  return members
    .map((member) => String(member).replaceAll("\\", "/"))
    .filter((member) => member !== "." && member !== "./")
    .map((member) => member.replace(/^\.\//, "").replace(/\/+$/, ""));
}

export function validateArchiveMembers(members) {
  const normalized = normalizedMembers(members);
  for (const member of normalized) {
    if (!member || member.startsWith("/") || /^[A-Za-z]:\//.test(member)
      || member.split("/").some((part) => part === ".." || part === "")) {
      throw new Error(`Archive contains an unsafe path: ${member}`);
    }
  }
  return normalized;
}

function requireMember(members, pattern, label) {
  if (!members.some((member) => pattern.test(member))) {
    throw new Error(`Archive is missing required ${label}.`);
  }
}

export function validateLinuxPostgres(members) {
  const normalized = validateArchiveMembers(members);
  requireMember(normalized, /(^|\/)initdb$/, "initdb executable");
  requireMember(normalized, /(^|\/)pg_ctl$/, "pg_ctl executable");
  requireMember(normalized, /(^|\/)psql$/, "psql executable");
  return normalized;
}

export function validateLinuxPgvector(members) {
  const normalized = validateArchiveMembers(members);
  requireMember(normalized, /(^|\/)vector\.so$/, "pgvector library");
  requireMember(normalized, /(^|\/)share\/extension\/vector\.control$/, "pgvector extension control file");
  return normalized;
}

export function validateLinuxRedis(members) {
  const normalized = validateArchiveMembers(members);
  const servers = normalized.filter((member) => /(^|\/)redis-server$/.test(member));
  if (servers.length !== 1) {
    throw new Error("Archive must contain exactly one redis-server executable.");
  }
  return normalized;
}
