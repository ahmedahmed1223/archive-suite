import { generateText, generateObject } from "ai";
import { z } from "zod";

import { resolveAiProvider } from "./providers.js";

// AiProvider implementation backed by the Vercel AI SDK. Preferred over the
// hand-rolled client: `generateObject` + Zod gives validated structured output
// (no fragile regex JSON parsing), and streaming/tool-calling are available if
// needed later. Satisfies the same @archive/core AiProvider port, so the rest
// of the system (endpoint, SPA adapter) is untouched.
//
// Providers map to official @ai-sdk packages; the long tail (together/deepseek/
// xai/ollama) uses @ai-sdk/openai-compatible with the registry baseUrl.

const SYS = "أنت مساعد أرشفة عربي دقيق. التزم العربية الفصحى. أعد بيانات منظَّمة دقيقة.";

// Lazy provider-factory loader — only imports the SDK package actually needed,
// so an unused provider never loads. Throws (→ caller can fall back) when a
// provider can't be constructed.
async function buildModel(p, apiKey) {
  const compat = async (baseURL, name) => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return createOpenAICompatible({ name, baseURL, apiKey })(p.model);
  };
  switch (p.id) {
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(p.model);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(p.model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(p.model);
    }
    case "mistral": {
      const { createMistral } = await import("@ai-sdk/mistral");
      return createMistral({ apiKey })(p.model);
    }
    case "groq": {
      const { createGroq } = await import("@ai-sdk/groq");
      return createGroq({ apiKey })(p.model);
    }
    case "openrouter": {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      return createOpenRouter({ apiKey })(p.model);
    }
    default:
      // together / deepseek / xai / ollama / custom → OpenAI-compatible.
      return compat(p.baseUrl, p.id);
  }
}

/**
 * @param {object} cfg - { provider, apiKey, model?, baseUrl?, model: injectable for tests }
 * @param {object} [cfg.modelOverride] - inject a LanguageModel (e.g. MockLanguageModelV3) for tests
 */
export function createSdkAiProvider(cfg = {}) {
  const p = resolveAiProvider(cfg.provider, { baseUrl: cfg.baseUrl, model: cfg.model });
  if (!cfg.apiKey && p.id !== "ollama" && !cfg.modelOverride) {
    const err = new Error(`AI provider "${p.id}" requires an API key.`);
    err.statusCode = 400;
    throw err;
  }

  // Resolve the model once (lazily). Tests inject `modelOverride` directly.
  let modelPromise = null;
  const model = () => {
    if (cfg.modelOverride) return Promise.resolve(cfg.modelOverride);
    if (!modelPromise) modelPromise = buildModel(p, cfg.apiKey);
    return modelPromise;
  };

  async function obj(schema, prompt) {
    const { object } = await generateObject({ model: await model(), schema, system: SYS, prompt });
    return object;
  }
  async function text(messages, system) {
    // Pass system via the dedicated option (the SDK flags system-in-messages
    // as a prompt-injection risk).
    const { text: out } = await generateText({ model: await model(), system, messages });
    return out;
  }

  return {
    isAvailable() { return true; },

    async transcribe() {
      const err = new Error("التفريغ الصوتي يتطلّب نموذج صوت (Whisper) — غير مدعوم في مزوّد الدردشة.");
      err.statusCode = 400;
      throw err;
    },

    async summarize({ text: input } = {}) {
      return obj(
        z.object({ summary: z.string(), tags: z.array(z.string()) }),
        `لخّص النص التالي في فقرة موجزة واقترح حتى 8 وسوم.\n\nالنص:\n${input || ""}`
      );
    },

    async suggestTags({ name, summary, transcription, categories } = {}) {
      const cats = Array.isArray(categories) ? categories.map((c) => `${c.id}:${c.name || c.label || ""}`).join(", ") : "";
      return obj(
        z.object({ tags: z.array(z.string()), categoryIds: z.array(z.string()) }),
        `اقترح وسومًا ومعرّفات تصنيفات مناسبة. التصنيفات المتاحة: [${cats}].\n` +
        `العنوان: ${name || ""}\nالملخّص: ${summary || ""}\nالتفريغ: ${(transcription || "").slice(0, 4000)}`
      );
    },

    async proofread({ text: input } = {}) {
      return obj(
        z.object({ correctedText: z.string(), corrections: z.array(z.object({ before: z.string(), after: z.string() })) }),
        `دقّق النص العربي التالي لغويًّا وأعد النص المصحَّح وقائمة التصحيحات.\n\nالنص:\n${input || ""}`
      );
    },

    async autocompleteFields({ name, summary, transcription, categories } = {}) {
      const cats = Array.isArray(categories) ? categories.map((c) => `${c.id}:${c.name || c.label || ""}`).join(", ") : "";
      // Arbitrary field map → flexible record schema.
      const out = await obj(
        z.object({ fields: z.record(z.string(), z.string()) }),
        `اقترح قيمًا لحقول الأرشفة (اسم الحقل → القيمة). التصنيفات: [${cats}].\n` +
        `العنوان: ${name || ""}\nالملخّص: ${summary || ""}\nالتفريغ: ${(transcription || "").slice(0, 4000)}`
      );
      return out.fields || {};
    },

    async chat({ context, query, history } = {}) {
      const messages = [
        ...(Array.isArray(history) ? history.filter((m) => m && m.role && m.role !== "system" && m.content) : []),
        { role: "user", content: `السياق:\n${context || ""}\n\nالسؤال: ${query || ""}` }
      ];
      return text(messages, "أنت مساعد عربي يجيب اعتمادًا على السياق المقدَّم فقط. إن لم تجد الإجابة فقل ذلك بوضوح.");
    },

    async rankSearch({ query, items } = {}) {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return list;
      const indexed = list.map((it, i) => `${i}: ${it.title || it.name || it.id || ""}`).join("\n");
      const out = await obj(
        z.object({ order: z.array(z.number()) }),
        `رتّب العناصر حسب صلتها بالاستعلام "${query || ""}" من الأعلى صلةً. أعد فهارسها في order.\n\n${indexed}`
      );
      const order = Array.isArray(out.order) ? out.order : list.map((_, i) => i);
      const seen = new Set();
      const ranked = [];
      for (const idx of order) {
        if (Number.isInteger(idx) && idx >= 0 && idx < list.length && !seen.has(idx)) { seen.add(idx); ranked.push(list[idx]); }
      }
      list.forEach((it, i) => { if (!seen.has(i)) ranked.push(it); });
      return ranked;
    }
  };
}
