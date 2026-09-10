import { afterEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel, hasConfiguredModel, resolveModelConfig } from "./model";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("AI provider selection", () => {
  it("uses Groq without forwarding the old OpenRouter model", () => {
    expect(resolveModelConfig({ GROQ_API_KEY: "test-groq", AI_MODEL: "old/router-model" }))
      .toMatchObject({ provider: "groq", modelId: "openai/gpt-oss-120b" });
  });
  it("honors an explicit Groq model", () => {
    expect(resolveModelConfig({ AI_PROVIDER: "groq", GROQ_API_KEY: "test", GROQ_MODEL: "openai/gpt-oss-20b" }).modelId)
      .toBe("openai/gpt-oss-20b");
  });
  it("preserves legacy OpenRouter deployments", () => {
    expect(resolveModelConfig({ OPENROUTER_API_KEY: "test", AI_MODEL: "existing-model" }))
      .toMatchObject({ provider: "openrouter", modelId: "existing-model" });
  });
  it("does not fall back to a different provider when the selected key is missing", () => {
    expect(() => resolveModelConfig({ AI_PROVIDER: "groq", OPENROUTER_API_KEY: "test" })).toThrow("GROQ_API_KEY");
    expect(hasConfiguredModel({ AI_PROVIDER: "groq", OPENROUTER_API_KEY: "test" })).toBe(false);
  });
  it("rejects unsupported provider names", () => {
    expect(() => resolveModelConfig({ AI_PROVIDER: "unknown" })).toThrow("Choose groq or openrouter");
  });
  it("does not treat whitespace credentials as configured", () => {
    expect(hasConfiguredModel({ AI_PROVIDER: "groq", GROQ_API_KEY: "   " })).toBe(false);
  });
});

describe("Groq SDK transport", () => {
  function configure(content: string, status = 200) {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "synthetic-key");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(status === 200 ? {
      id: "synthetic-response", object: "chat.completion", created: 1,
      model: "openai/gpt-oss-120b",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } : { error: { message: "Rate limit reached", type: "rate_limit_error", code: "rate_limit_exceeded" } }), {
      status, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends compatible schemas, hides reasoning, and validates responses", async () => {
    const request = configure('{"answer":"synthetic result"}');
    const result = await generateObject({ model: getModel(), schema: z.object({ answer: z.string(), detail: z.string().optional() }), prompt: "Synthetic test" });
    expect(result.object.answer).toBe("synthetic result");
    const call = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(call[1].body as string);
    expect(body.reasoning_format).toBe("hidden");
    expect(body.response_format.json_schema.strict).toBe(false);
  });

  it("rejects schema-invalid output instead of accepting provider JSON as truth", async () => {
    configure('{"answer":42}');
    await expect(generateObject({ model: getModel(), schema: z.object({ answer: z.string() }), prompt: "Synthetic test", maxRetries: 0 })).rejects.toThrow();
  });

  it("surfaces a provider outage without returning mock evidence", async () => {
    configure("", 429);
    await expect(generateObject({ model: getModel(), schema: z.object({ answer: z.string() }), prompt: "Synthetic test", maxRetries: 0 })).rejects.toThrow("Rate limit");
  });
});
