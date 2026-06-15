import {
  COPILOT_MAX_HISTORY,
  appendMessage,
  trimHistory
} from "../../features/copilot/copilotModel.js";

// Copilot slice — lightweight open/closed + message state for the AI assistant
// side panel. Messages live in memory only (a conversation is ephemeral); the
// pure shaping lives in features/copilot/copilotModel.js.

export const copilotInitialState = {
  copilotOpen: false,
  copilotMessages: []
};

export const copilotActionKeys = [
  "toggleCopilot",
  "setCopilotOpen",
  "addCopilotMessage",
  "clearCopilot"
];

export function createCopilotActions({ set, get }) {
  return {
    toggleCopilot: () => set((state) => ({ copilotOpen: !state.copilotOpen })),

    setCopilotOpen: (open) => set({ copilotOpen: Boolean(open) }),

    addCopilotMessage: (msg) => {
      const next = trimHistory(appendMessage(get().copilotMessages, msg), COPILOT_MAX_HISTORY);
      set({ copilotMessages: next });
      return next;
    },

    clearCopilot: () => set({ copilotMessages: [] })
  };
}
