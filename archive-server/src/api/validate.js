// Per-method argument validation for the RPC API. Defense-in-depth: the
// StorageProvider handles odd inputs gracefully, but rejecting malformed
// requests at the edge keeps bad data out and surfaces clear 400s.
//
// Validates shape/type only — not business rules. `store` must be a sane
// identifier; records must be objects; batch args must be arrays.

const STORE_RE = /^[a-z][a-z0-9_]{0,63}$/; // snake_case collection names

function bad(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function assertStore(store) {
  if (typeof store !== "string" || !STORE_RE.test(store)) {
    throw bad(`Invalid store name: ${JSON.stringify(store)}`);
  }
}

function assertKeyDefined(key) {
  if (key === undefined || key === null || (typeof key !== "string" && typeof key !== "number")) {
    throw bad("Key must be a string or number.");
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw bad(`${label} must be an object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw bad(`${label} must be an array.`);
}

// One validator per port method. Receives the raw args array.
const VALIDATORS = {
  open: () => {},
  get: ([store, key]) => { assertStore(store); assertKeyDefined(key); },
  getAll: ([store, opts]) => {
    assertStore(store);
    if (opts !== undefined && opts !== null) {
      assertObject(opts, "pagination opts");
      if (opts.cursor !== undefined && opts.cursor !== null && typeof opts.cursor !== "string") {
        throw bad("cursor must be a string.");
      }
      if (opts.limit !== undefined && opts.limit !== null) {
        if (typeof opts.limit !== "number" || !Number.isInteger(opts.limit) || opts.limit < 1) {
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
      if (opts.store !== undefined && opts.store !== null) assertStore(opts.store);
      if (opts.cursor !== undefined && opts.cursor !== null && typeof opts.cursor !== "string") {
        throw bad("cursor must be a string.");
      }
      if (opts.limit !== undefined && opts.limit !== null) {
        if (typeof opts.limit !== "number" || !Number.isInteger(opts.limit) || opts.limit < 1) {
          throw bad("limit must be a positive integer.");
        }
      }
    }
  },
  replaceAll: ([payload]) => { assertObject(payload, "payload"); }
};

/**
 * Validate RPC args for a method. Throws a 400 error on bad shape.
 * Assumes the method name is already known/allow-listed by the dispatcher.
 */
export function validateRpcArgs(method, args = []) {
  const validator = VALIDATORS[method];
  if (validator) validator(args);
}
