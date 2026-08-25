import { MockAIProvider } from "./mock-provider";
import { GemmaProvider } from "./gemma-provider";
import type { AIProvider } from "./provider";

/**
 * Single swap point. Real AI (OpenRouter, model from AI_MODEL) is used when
 * OPENROUTER_API_KEY is configured; otherwise the demo falls back to the
 * mock provider so Phase 1's flow keeps working with no setup. No app code
 * imports MockAIProvider or GemmaProvider directly — only this file decides.
 */
export const aiProvider: AIProvider = process.env.OPENROUTER_API_KEY
  ? new GemmaProvider()
  : new MockAIProvider();

export type { AIProvider } from "./provider";
export * from "./schemas";
