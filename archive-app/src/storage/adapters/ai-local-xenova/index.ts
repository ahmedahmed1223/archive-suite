// G2 — in-browser transcription adapter (AiProvider port, transcribe-only).
//
// Runs Whisper locally via transformers.js (loaded lazily from a CDN so it
// never weighs on the app bundle) — no server, no API key. Only `transcribe`
// is implemented; the generative text methods reject (local chat is out of
// scope). isAvailable() stays false so the text-AI affordances remain hidden;
// the Transcriber page calls transcribe() directly.
//
// All heavy/browser-only bits (model pipeline + audio decoding) are injectable,
// so the adapter logic is unit-tested without a browser, network, or model.

const TEXT_UNAVAILABLE =
  "التفريغ المحلي يدعم تحويل الصوت إلى نص فقط؛ ميزات النص الذكي تتطلّب مزوّدًا سحابيًّا.";
const DEFAULT_MODEL = "Xenova/whisper-tiny";
// Pinned ESM CDN build; the model weights are fetched + cached by the library.
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";

function reject(): Promise<never> {
  return Promise.reject(new Error(TEXT_UNAVAILABLE));
}

/** transformers.js ASR output -> the { transcription, segments } shape the app/cloud use. */
export function formatWhisperOutput(output: any = {}) {
  const transcription = String(output?.text || "").trim();
  const chunks = Array.isArray(output?.chunks) ? output.chunks : [];
  const segments = chunks
    .map((chunk: any) => {
      const ts = Array.isArray(chunk?.timestamp) ? chunk.timestamp : [];
      return {
        start: Number(ts[0]) || 0,
        end: Number(ts[1] ?? ts[0]) || 0,
        text: String(chunk?.text || "").trim()
      };
    })
    .filter((seg: { text: string }) => seg.text);
  return { transcription, segments };
}

type PipelineFactory = (model: string) => Promise<(audio: any, options?: any) => Promise<any>>;
type DecodeAudio = (blob: Blob) => Promise<Float32Array>;

/** Default model loader: lazy CDN import of transformers.js -> an ASR pipeline. */
async function defaultPipelineFactory(model: string) {
  // @vite-ignore keeps the bundler from trying to resolve/inline the CDN module.
  const mod: any = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
  const pipeline = mod.pipeline || mod.default?.pipeline;
  if (typeof pipeline !== "function") throw new Error("تعذّر تحميل مكتبة التفريغ.");
  return pipeline("automatic-speech-recognition", model || DEFAULT_MODEL);
}

/** Default audio decode: blob -> mono Float32Array @16kHz via the Web Audio API. */
async function defaultDecodeAudio(blob: Blob) {
  const globals = globalThis as any;
  const AudioCtx = globals.AudioContext || globals.webkitAudioContext;
  if (!AudioCtx) throw new Error("هذا المتصفّح لا يدعم فكّ ترميز الصوت محليًّا.");
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioCtx({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return decoded.getChannelData(0);
  } finally {
    if (typeof ctx.close === "function") ctx.close();
  }
}

export function createLocalXenovaAiProvider({
  model = DEFAULT_MODEL,
  pipelineFactory = defaultPipelineFactory,
  decodeAudio = defaultDecodeAudio
}: {
  model?: string;
  pipelineFactory?: PipelineFactory;
  decodeAudio?: DecodeAudio;
} = {}) {
  let asrPromise: Promise<any> | null = null; // memoize the (expensive) pipeline across calls
  const getAsr = () => {
    if (!asrPromise) asrPromise = Promise.resolve(pipelineFactory(model));
    return asrPromise;
  };

  return {
    // No local LLM -> keep the text-AI affordances hidden; transcription is
    // offered explicitly by the Transcriber page rather than via isAvailable().
    isAvailable() {
      return false;
    },
    /** Marker so callers can detect local transcription capability (duck-typed). */
    canTranscribe() {
      return true;
    },

    async transcribe({ blob, audio, onProgress }: { blob?: Blob; audio?: Float32Array; onProgress?: (event: any) => void } = {}) {
      if (!blob && !audio) throw new Error("لا يوجد ملف صوت للتفريغ.");
      const asr = await getAsr();
      const input = audio || await decodeAudio(blob as Blob);
      const output = await asr(input, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        ...(typeof onProgress === "function" ? { callback_function: onProgress } : {})
      });
      return formatWhisperOutput(output);
    },

    summarize: reject,
    suggestTags: reject,
    proofread: reject,
    autocompleteFields: reject,
    chat: reject,
    rankSearch: reject
  };
}

export default createLocalXenovaAiProvider;
