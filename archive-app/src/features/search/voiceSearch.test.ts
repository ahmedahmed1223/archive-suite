import { describe, expect, it } from "vitest";

import {
  extractSpeechTranscript,
  getSpeechRecognitionConstructor,
  isVoiceSearchSupported,
  parseVoiceSearchIntent,
  type VoiceSearchScope
} from "./voiceSearch.js";

describe("voice search support", () => {
  it("detects standard and webkit SpeechRecognition constructors", () => {
    function StandardRecognition() {}
    function WebkitRecognition() {}

    expect(getSpeechRecognitionConstructor({ SpeechRecognition: StandardRecognition } as VoiceSearchScope)).toBe(StandardRecognition);
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition: WebkitRecognition } as VoiceSearchScope)).toBe(WebkitRecognition);
    expect(isVoiceSearchSupported({ webkitSpeechRecognition: WebkitRecognition } as VoiceSearchScope)).toBe(true);
    expect(isVoiceSearchSupported({})).toBe(false);
  });
});

describe("parseVoiceSearchIntent", () => {
  it("turns Arabic search speech into a normalized search query", () => {
    expect(parseVoiceSearchIntent("  إبحث عن محاضرات يونيو 2026  ")).toMatchObject({
      kind: "search",
      query: "محاضرات يونيو 2026",
      normalizedQuery: "محاضرات يونيو 2026"
    });
  });

  it("detects open and add commands without losing the spoken target", () => {
    expect(parseVoiceSearchIntent("افتح ملف المقابلة")).toMatchObject({
      kind: "open",
      query: "ملف المقابلة",
      normalizedQuery: "ملف المقابله"
    });

    expect(parseVoiceSearchIntent("أضف مادة جديدة")).toMatchObject({
      kind: "add",
      query: "مادة جديدة",
      normalizedQuery: "ماده جديده"
    });
  });

  it("falls back to a search intent when no command prefix is spoken", () => {
    expect(parseVoiceSearchIntent("صور الأرشيف القديمة")).toMatchObject({
      kind: "search",
      query: "صور الأرشيف القديمة",
      normalizedQuery: "صور الارشيف القديمه"
    });
  });
});

describe("extractSpeechTranscript", () => {
  it("reads the recognized transcript from a browser speech event", () => {
    const event = {
      resultIndex: 1,
      results: [
        [{ transcript: "ignored" }],
        [{ transcript: "ابحث عن تقرير يونيو" }]
      ]
    };

    expect(extractSpeechTranscript(event)).toBe("ابحث عن تقرير يونيو");
  });
});
