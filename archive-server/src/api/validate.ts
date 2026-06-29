const STORE_RE = /^[a-z][a-z0-9_]{0,63}$/;
const FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

function bad(message: string): Error {
  const err = new Error(message);
  (err as any).statusCode = 400;
  return err;
}

function assertStore(store: unknown): void {
  if (typeof store !== "string" || !STORE_RE.test(store)) {
    throw bad(`Invalid store name: ${JSON.stringify(store)}`);
  }
}

function assertKeyDefined(key: unknown): void {
  if (key === undefined || key === null || (typeof key !== "string" && typeof key !== "number")) {
    throw bad("Key must be a string or number.");
  }
}

function assertObject(value: unknown, label: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw bad(`${label} must be an object.`);
  }
}

function assertArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw bad(`${label} must be an array.`);
}

type ValidatorFn = (args: unknown[]) => void;

const VALIDATORS: Record<string, ValidatorFn> = {
  open: () => {},
  get: ([store, key]) => { assertStore(store); assertKeyDefined(key); },
  getAll: ([store, opts]) => {
    assertStore(store);
    if (opts !== undefined && opts !== null) {
      assertObject(opts, "pagination opts");
      const optsObj = opts as Record<string, unknown>;
      if (optsObj.cursor !== undefined && optsObj.cursor !== null && typeof optsObj.cursor !== "string") {
        throw bad("cursor must be a string.");
      }
      if (optsObj.limit !== undefined && optsObj.limit !== null) {
        if (typeof optsObj.limit !== "number" || !Number.isInteger(optsObj.limit) || optsObj.limit < 1) {
          throw bad("limit must be a positive integer.");
        }
      }
    }
  },
  put: ([store, record]) => { assertStore(store); assertObject(record, "record"); },
  add: ([store, record]) => { assertStore(store); assertObject(record, "record"); },
  delete: ([store, key]) => { assertStore(store); assertKeyDefined(key); },
  clear: ([store]) => { assertStore(store); },
  putBatch: ([store, items]) => { assertStore(store); assertArray(items, "items"); },
  deleteBatch: ([store, keys]) => { assertStore(store); assertArray(keys, "keys"); },
  snapshot: ([opts] = []) => {
    if (opts !== undefined && opts !== null) {
      assertObject(opts, "snapshot opts");
      const optsObj = opts as Record<string, unknown>;
      if (optsObj.store !== undefined && optsObj.store !== null) assertStore(optsObj.store);
      if (optsObj.cursor !== undefined && optsObj.cursor !== null && typeof optsObj.cursor !== "string") {
        throw bad("cursor must be a string.");
      }
      if (optsObj.limit !== undefined && optsObj.limit !== null) {
        if (typeof optsObj.limit !== "number" || !Number.isInteger(optsObj.limit) || optsObj.limit < 1) {
          throw bad("limit must be a positive integer.");
        }
      }
    }
  },
  replaceAll: ([payload]) => { assertObject(payload, "payload"); },
  getByField: ([store, field, value]) => {
    assertStore(store);
    if (typeof field !== "string" || !FIELD_RE.test(field)) {
      throw bad(`Invalid field name: ${JSON.stringify(field)}`);
    }
    if (typeof value !== "string" && typeof value !== "number") {
      throw bad("value must be a string or number.");
    }
  }
};

export function validateRpcArgs(method: string, args: unknown[] = []): void {
  const validator = VALIDATORS[method];
  if (validator) validator(args);
}
