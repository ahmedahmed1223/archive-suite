const DENSITY_LABELS = {
  compact: "كثيف",
  balanced: "متوازن",
  comfortable: "مريح"
} as const;

const CARD_STYLE_CLASSES = {
  minimal: "border-transparent bg-transparent shadow-none",
  outlined: "border-base-300 bg-base-100",
  filled: "border-base-300 bg-base-200"
} as const;

interface AppearanceDraft {
  visualDensity?: keyof typeof DENSITY_LABELS | string;
  cardStyle?: keyof typeof CARD_STYLE_CLASSES | string;
  daisyTheme?: string;
  accentColor?: string;
  fontScale?: string;
}

export function getAppearancePreviewModel(draft: AppearanceDraft = {}) {
  const densityLabel = DENSITY_LABELS[draft.visualDensity as keyof typeof DENSITY_LABELS] || DENSITY_LABELS.balanced;
  const cardClass = CARD_STYLE_CLASSES[draft.cardStyle as keyof typeof CARD_STYLE_CLASSES] || CARD_STYLE_CLASSES.filled;
  const daisyTheme = draft.daisyTheme || "default";
  const accentColor = draft.accentColor || "teal";
  const fontScale = draft.fontScale || "normal";

  return {
    cardClass,
    densityLabel,
    summary: `DaisyUI ${daisyTheme}، لون ${accentColor}، خط ${fontScale}.`
  };
}
