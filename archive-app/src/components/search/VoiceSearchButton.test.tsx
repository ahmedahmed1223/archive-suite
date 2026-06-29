// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoiceSearchButton } from "./VoiceSearchButton.jsx";

afterEach(() => {
  const browserWindow = window as Window & {
    SpeechRecognition?: new () => unknown;
    webkitSpeechRecognition?: new () => unknown;
  };
  delete browserWindow.SpeechRecognition;
  delete browserWindow.webkitSpeechRecognition;
});

describe("VoiceSearchButton", () => {
  it("starts Arabic speech recognition and emits a parsed intent", async () => {
    const onIntent = vi.fn();
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => FakeRecognition;
      webkitSpeechRecognition?: new () => FakeRecognition;
    };
    let recognition: FakeRecognition | undefined;

    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onstart?: () => void;
      onresult?: (event: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => void;
      onend?: () => void;

      constructor() {
        recognition = this;
      }

      start() {
        this.onstart?.();
      }

      abort() {}
    }

    browserWindow.SpeechRecognition = FakeRecognition;

    render(<VoiceSearchButton onIntent={onIntent} />);

    fireEvent.click(screen.getByRole("button", { name: "بدء البحث الصوتي" }));

    expect(recognition).toBeDefined();
    expect(recognition!.lang).toBe("ar-SA");
    expect(recognition!.interimResults).toBe(false);
    expect(recognition!.continuous).toBe(false);

    recognition!.onresult?.({
      resultIndex: 0,
      results: [[{ transcript: "ابحث عن محاضرات يونيو" }]]
    });
    recognition!.onend?.();

    await waitFor(() => {
      expect(onIntent).toHaveBeenCalledWith(expect.objectContaining({
        kind: "search",
        query: "محاضرات يونيو"
      }));
    });
  });

  it("calls the unsupported fallback when speech recognition is unavailable", () => {
    const onUnsupported = vi.fn();
    render(<VoiceSearchButton onUnsupported={onUnsupported} />);

    fireEvent.click(screen.getByRole("button", { name: "البحث الصوتي غير متاح" }));

    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });
});
