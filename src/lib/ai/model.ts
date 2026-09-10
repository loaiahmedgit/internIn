import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";

type Environment = Record<string, string | undefined>;

/** Provider-specific model names prevent a retained OpenRouter model setting
 * from accidentally being sent to Groq during a provider switch. */
export function resolveModelConfig(env: Environment = process.env) {
  const provider = env.AI_PROVIDER?.trim() || (env.GROQ_API_KEY?.trim() ? "groq" : "openrouter");
  if (provider !== "groq" && provider !== "openrouter") {
    throw new Error("Choose groq or openrouter as AI_PROVIDER.");
  }
  const keyName = provider === "groq" ? "GROQ_API_KEY" : "OPENROUTER_API_KEY";
  const apiKey = env[keyName]?.trim();
  if (!apiKey) throw new Error(`${keyName} is not configured. AI assistance is unavailable; manual editing remains available.`);
  const modelId = provider === "groq"
    ? env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b"
    : env.OPENROUTER_MODEL?.trim() || env.AI_MODEL?.trim() || "google/gemma-4-31b-it-20260402";
  return { provider, apiKey, modelId };
}

export function hasConfiguredModel(env: Environment = process.env): boolean {
  try { resolveModelConfig(env); return true; } catch { return false; }
}

export function getModel() {
  const config = resolveModelConfig();
  if (config.provider === "openrouter") {
    return createOpenRouter({ apiKey: config.apiKey })(config.modelId);
  }
  return wrapLanguageModel({
    model: createGroq({ apiKey: config.apiKey })(config.modelId),
    middleware: defaultSettingsMiddleware({ settings: {
      providerOptions: { groq: {
        // Existing contracts contain optional fields. Best-effort JSON schema
        // preserves those contracts; generateObject still validates with Zod.
        strictJsonSchema: false,
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } },
    } }),
  });
}
