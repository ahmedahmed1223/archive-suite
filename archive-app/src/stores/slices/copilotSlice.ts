import {
  COPILOT_MAX_HISTORY,
  appendMessage,
  trimHistory
} from "../../features/copilot/copilotModel.js";

type StoreCtx = { set: any; get: () => any };

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

export function createCopilotActions({ set, get }: StoreCtx) {
  return {
    toggleCopilot: () => set((state: any) => ({ copilotOpen: !state.copilotOpen })),
    setCopilotOpen: (open: any) => set({ copilotOpen: Boolean(open) }),
    addCopilotMessage: (msg: any) => {
      const next = trimHistory(appendMessage(get().copilotMessages, msg), COPILOT_MAX_HISTORY);
      set({ copilotMessages: next });
      return next;
    },
    clearCopilot: () => set({ copilotMessages: [] })
  };
}
