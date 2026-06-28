const numberParam = (defaultValue: number, min: number, max: number) => ({ kind: "number" as const, defaultValue, min, max });
const colorParam = (defaultValue: string) => ({ kind: "color" as const, defaultValue });

export const FILTER_DEFINITIONS = Object.freeze({
  brightness: {
    label: "Brightness",
    params: { amount: numberParam(0, -1, 1) },
    preview: true,
    ffmpeg: "eq=brightness"
  },
  contrast: {
    label: "Contrast",
    params: { amount: numberParam(1, 0, 3) },
    preview: true,
    ffmpeg: "eq=contrast"
  },
  saturation: {
    label: "Saturation",
    params: { amount: numberParam(1, 0, 3) },
    preview: true,
    ffmpeg: "eq=saturation"
  },
  grayscale: {
    label: "Grayscale",
    params: { amount: numberParam(1, 0, 1) },
    preview: true,
    ffmpeg: "hue=s=0"
  },
  sepia: {
    label: "Sepia",
    params: { amount: numberParam(1, 0, 1) },
    preview: true,
    ffmpeg: "colorchannelmixer=sepia"
  },
  blur: {
    label: "Blur",
    params: { radius: numberParam(0, 0, 50) },
    preview: true,
    ffmpeg: "gblur=sigma"
  },
  temperature: {
    label: "Temperature",
    params: {
      amount: numberParam(0, -1, 1),
      tint: numberParam(0, -1, 1)
    },
    preview: false,
    ffmpeg: "colorbalance"
  },
  vignette: {
    label: "Vignette",
    params: {
      amount: numberParam(0.5, 0, 1),
      softness: numberParam(0.5, 0, 1)
    },
    preview: false,
    ffmpeg: "vignette"
  },
  sharpen: {
    label: "Sharpen",
    params: { amount: numberParam(1, 0, 3) },
    preview: false,
    ffmpeg: "unsharp"
  },
  chromaKey: {
    label: "Chroma key",
    params: {
      color: colorParam("#00ff00"),
      threshold: numberParam(0.2, 0, 1),
      softness: numberParam(0.1, 0, 1)
    },
    preview: false,
    ffmpeg: "chromakey"
  }
});

function normalizeParam(value: unknown, definition: { kind: "number" | "color"; defaultValue: unknown; min?: number; max?: number }): unknown {
  if (definition.kind === "color") {
    const color = String(value || definition.defaultValue).trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : definition.defaultValue;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return definition.defaultValue;
  return Math.max(definition.min as number, Math.min(definition.max as number, number));
}

type NormalizedClipFilter = {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  params: Record<string, unknown>;
  exportOnly?: boolean;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

export function normalizeClipFilter(filter: { type?: string; id?: string; enabled?: boolean; order?: number; params?: Record<string, unknown> } = {}, fallbackOrder = 0, fallbackId?: string): NormalizedClipFilter | null {
  const type = String(filter.type || "").trim();
  const definition = (FILTER_DEFINITIONS as Record<string, { params: Record<string, { kind: "number" | "color"; defaultValue: unknown; min?: number; max?: number }>; preview: boolean }>)[type];
  if (!definition) return null;
  const params = Object.fromEntries(Object.entries(definition.params).map(([name, paramDefinition]) => [
    name,
    normalizeParam(filter.params?.[name], paramDefinition)
  ]));
  const normalized: NormalizedClipFilter = {
    id: String(filter.id || fallbackId || `${type}-${fallbackOrder + 1}`),
    type,
    enabled: filter.enabled === undefined ? true : Boolean(filter.enabled),
    order: Number.isInteger(Number(filter.order)) ? Number(filter.order) : fallbackOrder,
    params
  };
  if (!definition.preview) normalized.exportOnly = true;
  return normalized;
}

export function normalizeClipFilters(filters: unknown[] = []) {
  const counts = new Map<string, number>();
  return (Array.isArray(filters) ? filters : [])
    .map((filter, index) => {
      const type = String((filter as { type?: string })?.type || "").trim();
      const count = (counts.get(type) || 0) + 1;
      counts.set(type, count);
      return normalizeClipFilter(filter as { type?: string }, index, `${type}-${count}`);
    })
    .filter(isDefined)
    .sort((a, b) => a.order - b.order)
    .map((filter, order) => ({ ...filter, order }));
}

export function isPreviewSupported(filterOrType: { type?: string } | string) {
  const type = typeof filterOrType === "string" ? filterOrType : filterOrType?.type;
  return Boolean((FILTER_DEFINITIONS as Record<string, { preview: boolean }>)[type as string]?.preview);
}

function formatNumber(value: unknown) {
  return Number(Number(value).toFixed(4)).toString();
}

function cssValue(filter: { type: string; params?: Record<string, unknown> }) {
  const amount = filter.params?.amount;
  if (filter.type === "brightness") return `brightness(${formatNumber(1 + Number(amount))})`;
  if (filter.type === "contrast") return `contrast(${formatNumber(amount)})`;
  if (filter.type === "saturation") return `saturate(${formatNumber(amount)})`;
  if (filter.type === "grayscale") return `grayscale(${formatNumber(amount)})`;
  if (filter.type === "sepia") return `sepia(${formatNumber(amount)})`;
  if (filter.type === "blur") return `blur(${formatNumber(filter.params?.radius)}px)`;
  return "";
}

export function buildCssFilter(filters: unknown[] = []) {
  return normalizeClipFilters(filters)
    .filter((filter) => filter.enabled && isPreviewSupported(filter))
    .map(cssValue)
    .filter(Boolean)
    .join(" ");
}
