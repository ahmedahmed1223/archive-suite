import assert from "node:assert/strict";
import { isAiProvider } from "@archive/core";

import { AI_PROVIDERS, listAiProviders, resolveAiProvider } from "../src/ai/providers.js";
import { createAiChatClient, parseJsonReply, AiError } from "../src/ai/client.js";
import { createCloudAiProvider } from "../src/ai/aiProvider.js";
import { dispatchAi, AI_RPC_METHODS } from "../src/api/aiHandler.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";
import { createTranscriber, listTranscribeProviders, resolveTranscribeProvider, TranscribeError } from "../src/ai/transcription.js";
import { createAiProvider } from "../src/ai/createAiProvider.js";

// Multi-provider AI library tests — registry + unified client (OpenAI +
// Anthropic shapes) + AiProvider port impl. All offline via a fake fetch that
// records requests and returns canned replies.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

run("registry — covers OpenRouter + major providers, resolves overrides", () => {
  const ids = Object.keys(AI_PROVIDERS);
  for (const must of ["openrouter", "openai", "anthropic", "google", "groq", "ollama"]) {
    assert.ok(ids.includes(must), `missing provider ${must}`);
  }
  assert.ok(listAiProviders().every((p) => p.id && p.label && p.defaultModel));
  const r = resolveAiProvider("openrouter", { model: "anthropic/claude-3.5-sonnet" });
  assert.equal(r.kind, "openai");
  assert.equal(r.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(r.model, "anthropic/claude-3.5-sonnet");
  assert.throws(() => resolveAiProvider("nope"), /Unknown AI provider/);
});

function fakeFetch(captured, reply) {
  return async (url, init) => {
    captured.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => reply };
  };
}

run("client — OpenAI-compatible request shape (OpenRouter)", async () => {
  const cap = [];
  const client = createAiChatClient({
    provider: "openrouter", apiKey: "k1", model: "x/y",
    fetchImpl: fakeFetch(cap, { choices: [{ message: { content: "مرحبا" } }] }),
    appUrl: "https://app.example.com", appTitle: "Archive"
  });
  const text = await client.chat([{ role: "user", content: "هلا" }]);
  assert.equal(text, "مرحبا");
  assert.equal(cap[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(cap[0].headers.Authorization, "Bearer k1");
  assert.equal(cap[0].headers["HTTP-Referer"], "https://app.example.com");
  assert.equal(cap[0].body.model, "x/y");
});

run("client — Anthropic native request shape (system split out)", async () => {
  const cap = [];
  const client = createAiChatClient({
    provider: "anthropic", apiKey: "ak",
    fetchImpl: fakeFetch(cap, { content: [{ text: "أهلاً" }] })
  });
  const text = await client.chat([
    { role: "system", content: "كن موجزًا" },
    { role: "user", content: "اشرح" }
  ]);
  assert.equal(text, "أهلاً");
  assert.equal(cap[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(cap[0].headers["x-api-key"], "ak");
  assert.equal(cap[0].headers["anthropic-version"], "2023-06-01");
  assert.equal(cap[0].body.system, "كن موجزًا");
  assert.deepEqual(cap[0].body.messages, [{ role: "user", content: "اشرح" }]);
});

run("client — missing key rejects (except ollama)", () => {
  assert.throws(() => createAiChatClient({ provider: "openai" }), /requires an API key/);
  // ollama (local) needs no key
  const c = createAiChatClient({ provider: "ollama", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(c.provider.id, "ollama");
});

run("client — HTTP error surfaces AiError with status", async () => {
  const client = createAiChatClient({
    provider: "openai", apiKey: "k",
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "rate limited" } }) })
  });
  await assert.rejects(() => client.chat([{ role: "user", content: "x" }]), (e) => {
    assert.ok(e instanceof AiError); assert.equal(e.status, 429); assert.match(e.message, /rate limited/); return true;
  });
});

run("parseJsonReply tolerates fenced + noisy JSON", () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('بعض النص {"b":2} ذيل'), { b: 2 });
  assert.deepEqual(parseJsonReply("not json", { fallback: true }), { fallback: true });
});

run("AiProvider impl satisfies the port + isAvailable reflects key", () => {
  const withKey = createCloudAiProvider({ provider: "openrouter", apiKey: "k", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(isAiProvider(withKey), true);
  assert.equal(withKey.isAvailable(), true);
  const noKey = createCloudAiProvider({ provider: "openrouter" });
  assert.equal(isAiProvider(noKey), true);     // still satisfies the shape
  assert.equal(noKey.isAvailable(), false);     // but not configured
});

run("AiProvider — summarize + suggestTags parse JSON replies", async () => {
  const provider = createCloudAiProvider({
    provider: "openrouter", apiKey: "k",
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      const user = body.messages.find((m) => m.role === "user")?.content || "";
      // Disambiguate by a marker unique to each prompt (suggestTags asks for
      // معرّفات تصنيفات; summarize starts with "لخّص النص").
      const content = user.includes("معرّفات تصنيفات")
        ? '{"tags":["وسم"],"categoryIds":["c1"]}'
        : '{"summary":"ملخّص","tags":["خبر","سياسة"]}';
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
    }
  });
  const s = await provider.summarize({ text: "نص طويل" });
  assert.equal(s.summary, "ملخّص");
  assert.deepEqual(s.tags, ["خبر", "سياسة"]);
  const t = await provider.suggestTags({ name: "مادة", categories: [{ id: "c1", name: "أخبار" }] });
  assert.deepEqual(t.categoryIds, ["c1"]);
});

run("AiProvider — rankSearch reorders + keeps dropped items", async () => {
  const provider = createCloudAiProvider({
    provider: "openrouter", apiKey: "k",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"order":[2,0]}' } }] }) })
  });
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const ranked = await provider.rankSearch({ query: "x", items });
  assert.deepEqual(ranked.map((i) => i.id), ["c", "a", "b"]); // b was dropped by model → appended
});

run("AiProvider — not-configured rejects generative calls; transcribe always rejects", async () => {
  const noKey = createCloudAiProvider({ provider: "openrouter" });
  await assert.rejects(() => noKey.summarize({ text: "x" }), /غير مُهيّأ/);
  const withKey = createCloudAiProvider({ provider: "openrouter", apiKey: "k", fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(() => withKey.transcribe({}), /Whisper|تفريغ/);
});

run("dispatchAi allow-lists methods + 503 when AI unconfigured", async () => {
  assert.equal(AI_RPC_METHODS.includes("transcribe"), false); // binary, excluded
  assert.equal(AI_RPC_METHODS.includes("summarize"), true);
  const provider = createCloudAiProvider({ provider: "openrouter", apiKey: "k", fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"x","tags":[]}' } }] }) }) });
  const out = await dispatchAi({ method: "summarize", args: [{ text: "t" }] }, { resolveProvider: () => provider });
  assert.equal(out.summary, "x");
  await assert.rejects(() => dispatchAi({ method: "drop", args: [] }, { resolveProvider: () => provider }), /Unknown AI method/);
  // unconfigured → 503
  await assert.rejects(
    () => dispatchAi({ method: "summarize", args: [{}] }, { resolveProvider: () => { throw new Error("not configured"); } }),
    (e) => { assert.equal(e.statusCode, 503); return true; }
  );
});

run("HTTP: /api/ai/rpc requires auth + proxies to the AI provider", async () => {
  const SECRET = "ai-secret";
  const provider = createCloudAiProvider({
    provider: "openrouter", apiKey: "k",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"summary":"موجز","tags":["t"]}' } }] }) })
  });
  const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    aiDispatch: (body) => dispatchAi(body, { resolveProvider: () => provider })
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noAuth = await fetch(`${base}/api/ai/rpc`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "summarize", args: [{ text: "x" }] })
    });
    assert.equal(noAuth.status, 401);

    const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
    const ok = await fetch(`${base}/api/ai/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method: "summarize", args: [{ text: "نص" }] })
    }).then((r) => r.json());
    assert.equal(ok.ok, true);
    assert.equal(ok.result.summary, "موجز");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("transcription registry — openai/groq/whisper-local + resolve", () => {
  const ids = listTranscribeProviders().map((p) => p.id);
  for (const must of ["openai", "groq", "whisper-local"]) assert.ok(ids.includes(must), `missing ${must}`);
  const local = resolveTranscribeProvider("whisper-local", { baseUrl: "http://w:9000/v1/" });
  assert.equal(local.needsKey, false);
  assert.equal(local.baseUrl, "http://w:9000/v1");
  assert.throws(() => resolveTranscribeProvider("nope"), /Unknown transcription/);
});

run("transcriber posts multipart to /audio/transcriptions + parses verbose_json", async () => {
  let captured = null;
  const fetchImpl = async (url, init) => {
    captured = { url, headers: init.headers, isForm: init.body instanceof FormData };
    return { ok: true, status: 200, json: async () => ({ text: "نصّ مفرّغ", segments: [{ start: 0, end: 1.5, text: "نصّ" }] }) };
  };
  const t = createTranscriber({ provider: "groq", apiKey: "gk", fetchImpl });
  const out = await t.transcribe(Buffer.from("fakeaudio"), { mimeType: "audio/mpeg", name: "clip.mp3" });
  assert.equal(out.transcription, "نصّ مفرّغ");
  assert.equal(out.segments[0].text, "نصّ");
  assert.equal(captured.url, "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.equal(captured.headers.Authorization, "Bearer gk");
  assert.equal(captured.isForm, true);
});

run("transcriber: hosted needs key; local doesn't; HTTP error → TranscribeError", async () => {
  assert.throws(() => createTranscriber({ provider: "openai" }), /requires an API key/);
  const local = createTranscriber({ provider: "whisper-local", baseUrl: "http://w:8000/v1", fetchImpl: async () => ({ ok: true, json: async () => ({ text: "x" }) }) });
  assert.equal(local.provider.id, "whisper-local");
  const bad = createTranscriber({ provider: "groq", apiKey: "k", fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "bad key" } }) }) });
  await assert.rejects(() => bad.transcribe(Buffer.from("a")), (e) => { assert.ok(e instanceof TranscribeError); assert.equal(e.status, 401); return true; });
});

run("createAiProvider wires transcribe when transcribe.provider configured", async () => {
  const ai = createAiProvider({
    provider: "openrouter", apiKey: "k",
    transcribe: { provider: "groq", apiKey: "gk", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ text: "مفرّغ" }) }) }
  });
  const out = await ai.transcribe({ blob: Buffer.from("a"), mimeType: "audio/mpeg", name: "x.mp3" });
  assert.equal(out.transcription, "مفرّغ");
  // without transcribe config → rejects
  const noT = createAiProvider({ provider: "openrouter", apiKey: "k" });
  await assert.rejects(() => noT.transcribe({ blob: Buffer.from("a") }));
});

run("HTTP: /api/ai/transcribe forwards raw audio + requires auth", async () => {
  const SECRET = "tsecret";
  const provider = {
    transcribe: async ({ blob, mimeType, name }) => ({ transcription: `${name}:${mimeType}:${blob.length}`, segments: [] })
  };
  const server = createApiServer({ backend: "test", authSecret: SECRET, rateLimit: null, aiResolveProvider: () => provider });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noAuth = await fetch(`${base}/api/ai/transcribe`, { method: "POST", headers: { "Content-Type": "audio/mpeg" }, body: Buffer.from("abc") });
    assert.equal(noAuth.status, 401);
    const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
    const ok = await fetch(`${base}/api/ai/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav", Authorization: `Bearer ${token}`, "X-Filename": "rec.wav" },
      body: Buffer.from("abcde")
    }).then((r) => r.json());
    assert.equal(ok.ok, true);
    assert.equal(ok.result.transcription, "rec.wav:audio/wav:5");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll AI provider tests passed.");
});
