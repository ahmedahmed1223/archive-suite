// Shared motion tokens for the v4 identity. One ease curve; capped stagger
// so a 100-card grid does not produce seconds of animation (spec §3).
export const transitions = {
  micro:    { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  standard: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  page:     { duration: 0.40, ease: [0.4, 0, 0.2, 1] },
  stagger:  0.04,
  springCard: { type: "spring", stiffness: 400, damping: 30 }
};

const STAGGER_CAP = 12;

// Delay (seconds) for the index-th item; clamps past STAGGER_CAP so the
// total never exceeds STAGGER_CAP * stagger (~480ms).
export function staggerFor(index) {
  const i = index < STAGGER_CAP ? index : STAGGER_CAP;
  return i * transitions.stagger;
}

export const cardVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.standard },
  hover:   { y: -2, transition: transitions.springCard }
};
