import { describe, expect, it } from "vitest";
import { resolveCopilotProvider } from "./copilot-provider";

describe("resolveCopilotProvider", () => {
  it("defaults to anthropic when no provider is set", () => {
    const result = resolveCopilotProvider({ ANTHROPIC_API_KEY: "key" });
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-5");
    expect(result.ready).toBe(true);
    expect(result.languageModel).not.toBeNull();
  });

  it("falls back to anthropic for an unrecognized provider name", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "not-a-real-provider" });
    expect(result.provider).toBe("anthropic");
  });

  it("is not ready when the anthropic key is missing", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "anthropic" });
    expect(result.ready).toBe(false);
    expect(result.languageModel).toBeNull();
  });

  it("honors the legacy ARCHIVE_COPILOT_API_KEY as an anthropic key fallback", () => {
    const result = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "anthropic",
      ARCHIVE_COPILOT_API_KEY: "legacy-key"
    });
    expect(result.ready).toBe(true);
  });

  it("prefers ANTHROPIC_API_KEY over the legacy fallback when both are set", () => {
    const result = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "primary-key",
      ARCHIVE_COPILOT_API_KEY: "legacy-key"
    });
    expect(result.ready).toBe(true);
  });

  it("resolves openai using OPENAI_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "openai", OPENAI_API_KEY: "key" });
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5");
    expect(result.ready).toBe(true);
  });

  it("is not ready for openai without OPENAI_API_KEY", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "openai" });
    expect(result.ready).toBe(false);
  });

  it("resolves google using GOOGLE_GENERATIVE_AI_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "google",
      GOOGLE_GENERATIVE_AI_API_KEY: "key"
    });
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.ready).toBe(true);
  });

  it("resolves openai-compatible only when key, base URL, and model are all present", () => {
    const missingModel = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openai-compatible",
      ARCHIVE_COPILOT_COMPAT_API_KEY: "key",
      ARCHIVE_COPILOT_COMPAT_BASE_URL: "https://example.com/v1"
    });
    expect(missingModel.ready).toBe(false);
    expect(missingModel.model).toBeNull();

    const ready = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openai-compatible",
      ARCHIVE_COPILOT_COMPAT_API_KEY: "key",
      ARCHIVE_COPILOT_COMPAT_BASE_URL: "https://example.com/v1",
      ARCHIVE_COPILOT_MODEL: "llama-3.1-70b"
    });
    expect(ready.ready).toBe(true);
    expect(ready.model).toBe("llama-3.1-70b");
  });

  it("applies the ARCHIVE_COPILOT_MODEL override across providers", () => {
    const result = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openai",
      OPENAI_API_KEY: "key",
      ARCHIVE_COPILOT_MODEL: "gpt-5-mini"
    });
    expect(result.model).toBe("gpt-5-mini");
  });

  it("resolves groq using GROQ_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "groq", GROQ_API_KEY: "key" });
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(result.ready).toBe(true);
  });

  it("is not ready for groq without GROQ_API_KEY", () => {
    expect(resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "groq" }).ready).toBe(false);
  });

  it("resolves mistral using MISTRAL_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "mistral", MISTRAL_API_KEY: "key" });
    expect(result.provider).toBe("mistral");
    expect(result.model).toBe("mistral-large-latest");
    expect(result.ready).toBe(true);
  });

  it("is not ready for mistral without MISTRAL_API_KEY", () => {
    expect(resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "mistral" }).ready).toBe(false);
  });

  it("resolves xai using XAI_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "xai", XAI_API_KEY: "key" });
    expect(result.provider).toBe("xai");
    expect(result.model).toBe("grok-4");
    expect(result.ready).toBe(true);
  });

  it("is not ready for xai without XAI_API_KEY", () => {
    expect(resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "xai" }).ready).toBe(false);
  });

  it("resolves deepseek using DEEPSEEK_API_KEY and the default model", () => {
    const result = resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "key" });
    expect(result.provider).toBe("deepseek");
    expect(result.model).toBe("deepseek-chat");
    expect(result.ready).toBe(true);
  });

  it("is not ready for deepseek without DEEPSEEK_API_KEY", () => {
    expect(resolveCopilotProvider({ ARCHIVE_COPILOT_PROVIDER: "deepseek" }).ready).toBe(false);
  });

  it("resolves openrouter over the OpenAI-compatible client only with an explicit model", () => {
    const missingModel = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "key"
    });
    expect(missingModel.ready).toBe(false);
    expect(missingModel.model).toBeNull();

    const ready = resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "key",
      ARCHIVE_COPILOT_MODEL: "anthropic/claude-sonnet-5"
    });
    expect(ready.provider).toBe("openrouter");
    expect(ready.model).toBe("anthropic/claude-sonnet-5");
    expect(ready.ready).toBe(true);
  });

  it("is not ready for openrouter without OPENROUTER_API_KEY", () => {
    expect(resolveCopilotProvider({
      ARCHIVE_COPILOT_PROVIDER: "openrouter",
      ARCHIVE_COPILOT_MODEL: "anthropic/claude-sonnet-5"
    }).ready).toBe(false);
  });
});
