const DENSITY_LABELS = {
  compact: "كثيف",
  balanced: "متوازن",
  comfortable: "مريح"
};

const CARD_STYLE_CLASSES = {
  minimal: "border-transparent bg-transparent shadow-none",
  outlined: "border-base-300 bg-base-100",
  filled: "border-base-300 bg-base-200"
};

export function getAppearancePreviewModel(draft = {}) {
  const densityLabel = DENSITY_LABELS[draft.visualDensity] || DENSITY_LABELS.balanced;
  const cardClass = CARD_STYLE_CLASSES[draft.cardStyle] || CARD_STYLE_CLASSES.filled;
  const daisyTheme = draft.daisyTheme || "default";
  const accentColor = draft.accentColor || "teal";
  const fontScale = draft.fontScale || "normal";

  return {
    cardClass,
    densityLabel,
    summary: `DaisyUI ${daisyTheme}، لون ${accentColor}، خط ${fontScale}.`
  };
}
