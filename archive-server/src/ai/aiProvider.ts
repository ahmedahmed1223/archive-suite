import { createAiChatClient, parseJsonReply, AiError } from "./client.js";

// AiProvider implementation (satisfies @archive/core's 8-method port) backed by
// the unified multi-provider chat client. Generative methods use Arabic-first
// prompts with JSON output. `transcribe` needs an audio model (Whisper) — out
// of scope for a chat client, so it rejects with a clear message (a dedicated
// transcription adapter can satisfy that method later).

const SYS = "أنت مساعد أرشفة عربي دقيق. التزم العربية الفصحى وأعد JSON صالحًا فقط دون شرح.";

interface Category {
  id: string;
  name?: string;
  label?: string;
}

interface SummarizeInput {
  text?: string;
}

interface SummaryOutput {
  summary: string;
  tags: string[];
}

interface SuggestTagsInput {
  name?: string;
  summary?: string;
  transcription?: string;
  categories?: Category[];
}

interface SuggestTagsOutput {
  tags: string[];
  categoryIds: string[];
}

interface ProofreadInput {
  text?: string;
}

interface Correction {
  before: string;
  after: string;
}

interface ProofreadOutput {
  correctedText: string;
  corrections: Correction[];
}

interface AutocompleteInput {
  name?: string;
  summary?: string;
  transcription?: string;
  categories?: Category[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatInput {
  context?: string;
  query?: string;
  history?: ChatMessage[];
}

interface SearchItem {
  title?: string;
  name?: string;
  id?: string;
}

interface RankSearchInput {
  query?: string;
  items?: SearchItem[];
}

export function createCloudAiProvider(cfg: { apiKey?: string; provider?: string } = {}) {
  let client: ReturnType<typeof createAiChatClient> | null = null;
  try {
    if (cfg.apiKey || cfg.provider === "ollama") client = createAiChatClient({ ...cfg, provider: cfg.provider || "openai" });
  } catch {
    client = null;
  }

  const ensure = () => {
    if (!client) throw new AiError("مزوّد الذكاء غير مُهيّأ (مفتاح/مزوّد مفقود).", { provider: cfg.provider });
    return client;
  };

  async function jsonChat(userPrompt: string, fallback: unknown): Promise<unknown> {
    const reply = await ensure().chat(
      [{ role: "system", content: SYS }, { role: "user", content: userPrompt }],
      { json: true }
    );
    return parseJsonReply(reply, fallback);
  }

  return {
    isAvailable() {
      return Boolean(client);
    },

    async transcribe() {
      throw new AiError("التفريغ الصوتي يتطلّب نموذج صوت (Whisper) — غير مدعوم في مزوّد الدردشة. استخدم محوّل تفريغ مخصّصًا.", { provider: cfg.provider });
    },

    async summarize({ text }: SummarizeInput = {}): Promise<SummaryOutput> {
      const out = await jsonChat(
        `لخّص النص التالي في فقرة موجزة واقترح حتى 8 وسوم. أعد JSON: {"summary": string, "tags": string[]}.\n\nالنص:\n${text || ""}`,
        { summary: "", tags: [] }
      ) as Record<string, unknown>;
      const summary = typeof out.summary === "string" ? out.summary : "";
      return { summary, tags: Array.isArray(out.tags) ? out.tags : [] };
    },

    async suggestTags({ name, summary, transcription, categories }: SuggestTagsInput = {}): Promise<SuggestTagsOutput> {
      const cats = Array.isArray(categories) ? categories.map((c) => `${c.id}:${c.name || c.label || ""}`).join(", ") : "";
      const out = await jsonChat(
        `اقترح وسومًا ومعرّفات تصنيفات مناسبة. التصنيفات المتاحة: [${cats}].\n` +
        `أعد JSON: {"tags": string[], "categoryIds": string[]}.\n\n` +
        `العنوان: ${name || ""}\nالملخّص: ${summary || ""}\nالتفريغ: ${(transcription || "").slice(0, 4000)}`,
        { tags: [], categoryIds: [] }
      ) as Record<string, unknown>;
      return { tags: Array.isArray(out.tags) ? out.tags : [], categoryIds: Array.isArray(out.categoryIds) ? out.categoryIds : [] };
    },

    async proofread({ text }: ProofreadInput = {}): Promise<ProofreadOutput> {
      const out = await jsonChat(
        `دقّق النص العربي التالي لغويًّا. أعد JSON: {"correctedText": string, "corrections": [{"before": string, "after": string}]}.\n\nالنص:\n${text || ""}`,
        { correctedText: text || "", corrections: [] }
      ) as Record<string, unknown>;
      const correctedText = typeof out.correctedText === "string" ? out.correctedText : (text || "");
      return { correctedText, corrections: Array.isArray(out.corrections) ? out.corrections : [] };
    },

    async autocompleteFields({ name, summary, transcription, categories }: AutocompleteInput = {}): Promise<Record<string, string>> {
      const cats = Array.isArray(categories) ? categories.map((c) => `${c.id}:${c.name || c.label || ""}`).join(", ") : "";
      return jsonChat(
        `اقترح قيمًا لحقول الأرشفة بناءً على المعطيات. التصنيفات: [${cats}].\n` +
        `أعد JSON كائنًا من اسم الحقل إلى القيمة المقترحة.\n\n` +
        `العنوان: ${name || ""}\nالملخّص: ${summary || ""}\nالتفريغ: ${(transcription || "").slice(0, 4000)}`,
        {}
      ) as Promise<Record<string, string>>;
    },

    async chat({ context, query, history }: ChatInput = {}): Promise<string> {
      const messages: ChatMessage[] = [
        { role: "system", content: "أنت مساعد عربي يجيب اعتمادًا على السياق المقدَّم فقط. إن لم تجد الإجابة في السياق فقل ذلك بوضوح." },
        ...(Array.isArray(history) ? history.filter((m) => m && m.role && m.content) : []),
        { role: "user", content: `السياق:\n${context || ""}\n\nالسؤال: ${query || ""}` }
      ];
      return ensure().chat(messages, { json: false });
    },

    async rankSearch({ query, items }: RankSearchInput = {}): Promise<SearchItem[]> {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return list;
      const indexed = list.map((it, i) => `${i}: ${it.title || it.name || it.id || ""}`).join("\n");
      const out = await jsonChat(
        `رتّب العناصر التالية حسب صلتها بالاستعلام "${query || ""}" من الأعلى صلةً. أعد JSON: {"order": number[]} بالفهارس.\n\n${indexed}`,
        { order: list.map((_, i) => i) }
      ) as Record<string, unknown>;
      const order = Array.isArray(out.order) ? out.order : list.map((_, i) => i);
      const seen = new Set<number>();
      const ranked: SearchItem[] = [];
      for (const idx of order) {
        if (Number.isInteger(idx) && idx >= 0 && idx < list.length && !seen.has(idx as number)) { seen.add(idx as number); ranked.push(list[idx as number]); }
      }
      // Append any items the model dropped, preserving original order.
      list.forEach((it, i) => { if (!seen.has(i)) ranked.push(it); });
      return ranked;
    }
  };
}
