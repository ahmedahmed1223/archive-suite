import assert from "node:assert/strict";
import { isAiProvider } from "@archive/core";
import { MockLanguageModelV3 } from "ai/test";

import { createSdkAiProvider } from "../src/ai/sdkProvider.js";
import { createAiProvider } from "../src/ai/createAiProvider.js";

// Vercel AI SDK adapter tests — deterministic via MockLanguageModelV3 injected
// as `modelOverride` (no network, no keys). Verifies generateObject/generateText
// wiring, the port shape, and the SDK→manual selector + fallback.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

// Build a mock model that returns the given text as its single content part.
function mockModel(text) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: "text", text }],
      warnings: []
    })
  });
}

run("SDK adapter satisfies AiProvider port", () => {
  const ai = createSdkAiProvider({ provider: "openrouter", modelOverride: mockModel("{}") });
  assert.equal(isAiProvider(ai), true);
  assert.equal(ai.isAvailable(), true);
});

run("SDK summarize → validated object via generateObject", async () => {
  const ai = createSdkAiProvider({
    provider: "openai",
    modelOverride: mockModel('{"summary":"ملخّص دقيق","tags":["خبر","سياسة"]}')
  });
  const out = await ai.summarize({ text: "نص طويل" });
  assert.equal(out.summary, "ملخّص دقيق");
  assert.deepEqual(out.tags, ["خبر", "سياسة"]);
});

run("SDK suggestTags + rankSearch parse structured output", async () => {
  const tagsAi = createSdkAiProvider({
    provider: "anthropic",
    modelOverride: mockModel('{"tags":["وسم"],"categoryIds":["c1"]}')
  });
  const t = await tagsAi.suggestTags({ name: "مادة", categories: [{ id: "c1", name: "أخبار" }] });
  assert.deepEqual(t.tags, ["وسم"]);
  assert.deepEqual(t.categoryIds, ["c1"]);

  const rankAi = createSdkAiProvider({
    provider: "groq",
    modelOverride: mockModel('{"order":[2,0]}')
  });
  const ranked = await rankAi.rankSearch({ query: "x", items: [{ id: "a" }, { id: "b" }, { id: "c" }] });
  assert.deepEqual(ranked.map((i) => i.id), ["c", "a", "b"]); // b dropped by model → appended
});

run("SDK chat → plain text via generateText", async () => {
  const ai = createSdkAiProvider({ provider: "google", modelOverride: mockModel("الجواب من السياق") });
  const reply = await ai.chat({ context: "سياق", query: "سؤال" });
  assert.equal(reply, "الجواب من السياق");
});

run("SDK transcribe rejects (needs audio model)", async () => {
  const ai = createSdkAiProvider({ provider: "openrouter", modelOverride: mockModel("{}") });
  await assert.rejects(() => ai.transcribe({}), /Whisper|صوت/);
});

run("SDK adapter requires a key (no override) for keyed providers", () => {
  assert.throws(() => createSdkAiProvider({ provider: "openai" }), /requires an API key/);
});

run("selector: default uses SDK; AI_IMPL=manual uses hand-rolled", () => {
  // manual impl → hand-rolled (isAvailable false without key, still a valid port)
  const manual = createAiProvider({ provider: "openrouter", impl: "manual" });
  assert.equal(isAiProvider(manual), true);
  // sdk impl with an injected model works
  const sdk = createAiProvider({ provider: "openrouter", impl: "sdk", modelOverride: mockModel("{}") });
  assert.equal(isAiProvider(sdk), true);
  assert.equal(sdk.isAvailable(), true);
});

run("selector falls back to manual when SDK can't build (no key, no override)", () => {
  // sdk impl, keyed provider, no key, no override → SDK throws → manual fallback
  const provider = createAiProvider({ provider: "openai", impl: "sdk" });
  assert.equal(isAiProvider(provider), true);
  assert.equal(provider.isAvailable(), false); // manual fallback reports unconfigured
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll AI SDK adapter tests passed.");
});
