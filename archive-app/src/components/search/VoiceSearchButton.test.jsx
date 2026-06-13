// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoiceSearchButton } from "./VoiceSearchButton.jsx";

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("VoiceSearchButton", () => {
  it("starts Arabic speech recognition and emits a parsed intent", async () => {
    const onIntent = vi.fn();
    let recognition;

    class FakeRecognition {
      constructor() {
        recognition = this;
      }

      start() {
        this.onstart?.();
      }

      abort() {}
    }

    window.SpeechRecognition = FakeRecognition;

    render(<VoiceSearchButton onIntent={onIntent} />);

    fireEvent.click(screen.getByRole("button", { name: "بدء البحث الصوتي" }));

    expect(recognition.lang).toBe("ar-SA");
    expect(recognition.interimResults).toBe(false);
    expect(recognition.continuous).toBe(false);

    recognition.onresult?.({
      resultIndex: 0,
      results: [[{ transcript: "ابحث عن محاضرات يونيو" }]]
    });
    recognition.onend?.();

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
