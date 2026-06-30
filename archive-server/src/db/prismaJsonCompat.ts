type FieldConfig = {
  jsonFields?: readonly string[];
  listFields?: readonly string[];
};

const SQLSERVER_TEXT_FIELD_MODELS: Record<string, FieldConfig> = Object.freeze({
  archiveItem: { listFields: ["tags"], jsonFields: ["metadata"] },
  recordVersion: { jsonFields: ["snapshot"] },
  savedFilter: { jsonFields: ["query"] },
  webhook: { listFields: ["events"] },
  apiKey: { listFields: ["scopes"] },
  activityLog: { jsonFields: ["before", "after", "diff", "relatedIds", "context"] },
  shareInvitation: { jsonFields: ["scope"] },
  rightsRecord: { jsonFields: ["geoRestrictions"] },
});

const READ_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createManyAndReturn",
  "update",
  "updateManyAndReturn",
  "upsert",
]);

const WRITE_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);

const WHERE_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "count",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date));
}

function encodeJsonValue(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "string") return value;
  return JSON.stringify(value);
}

function decodeJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function encodeListValue(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "string") return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (isPlainObject(value) && Array.isArray(value.set)) return JSON.stringify(value.set);
  return value;
}

function decodeListValue(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function encodeData(data: unknown, config: FieldConfig): unknown {
  if (Array.isArray(data)) return data.map((item) => encodeData(item, config));
  if (!isPlainObject(data)) return data;

  const next = { ...data };
  for (const field of config.jsonFields || []) {
    if (Object.hasOwn(next, field)) next[field] = encodeJsonValue(next[field]);
  }
  for (const field of config.listFields || []) {
    if (Object.hasOwn(next, field)) next[field] = encodeListValue(next[field]);
  }
  return next;
}

function decodeRow(row: unknown, config: FieldConfig): unknown {
  if (Array.isArray(row)) return row.map((item) => decodeRow(item, config));
  if (!isPlainObject(row)) return row;

  const next = { ...row };
  for (const field of config.jsonFields || []) {
    if (Object.hasOwn(next, field)) next[field] = decodeJsonValue(next[field]);
  }
  for (const field of config.listFields || []) {
    if (Object.hasOwn(next, field)) next[field] = decodeListValue(next[field]);
  }
  return next;
}

function listContainsNeedle(value: unknown): string {
  return JSON.stringify(String(value));
}

function encodeWhere(where: unknown, config: FieldConfig): unknown {
  if (Array.isArray(where)) return where.map((item) => encodeWhere(item, config));
  if (!isPlainObject(where)) return where;

  const next: Record<string, unknown> = {};
  const listFields = new Set(config.listFields || []);
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      next[key] = encodeWhere(value, config);
      continue;
    }
    if (listFields.has(key) && isPlainObject(value)) {
      if (Object.hasOwn(value, "has")) {
        next[key] = { contains: listContainsNeedle(value.has) };
        continue;
      }
      if (Array.isArray(value.hasSome) && value.hasSome.length === 1) {
        next[key] = { contains: listContainsNeedle(value.hasSome[0]) };
        continue;
      }
    }
    next[key] = value;
  }
  return next;
}

function encodeArgs(args: unknown[], config: FieldConfig, method: string): unknown[] {
  if (!args.length || !isPlainObject(args[0])) return args;
  const first = { ...args[0] };

  if (WHERE_METHODS.has(method) && Object.hasOwn(first, "where")) {
    first.where = encodeWhere(first.where, config);
  }

  if (WRITE_METHODS.has(method)) {
    if (Object.hasOwn(first, "data")) first.data = encodeData(first.data, config);
    if (Object.hasOwn(first, "create")) first.create = encodeData(first.create, config);
    if (Object.hasOwn(first, "update")) first.update = encodeData(first.update, config);
  }

  return [first, ...args.slice(1)];
}

function wrapDelegate(delegate: Record<string, unknown>, config: FieldConfig) {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;

      return async (...args: unknown[]) => {
        const encodedArgs = encodeArgs(args, config, prop);
        const result = await value.apply(target, encodedArgs);
        return READ_METHODS.has(prop) ? decodeRow(result, config) : result;
      };
    },
  });
}

export function wrapSqlServerPrismaJsonCompat<T extends Record<string, any>>(
  prisma: T,
  databaseEngine: string
): T {
  if (String(databaseEngine || "").toLowerCase() !== "sqlserver") return prisma;

  const delegateCache = new Map<string, unknown>();
  return new Proxy(prisma, {
    get(target, prop, receiver) {
      if (typeof prop !== "string" || !Object.hasOwn(SQLSERVER_TEXT_FIELD_MODELS, prop)) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        return (value as (...args: unknown[]) => unknown).bind(target);
      }
      if (!delegateCache.has(prop)) {
        const delegate = Reflect.get(target, prop, receiver);
        delegateCache.set(prop, delegate ? wrapDelegate(delegate, SQLSERVER_TEXT_FIELD_MODELS[prop]) : delegate);
      }
      return delegateCache.get(prop);
    },
  }) as T;
}
