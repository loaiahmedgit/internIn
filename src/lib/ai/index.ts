import { MockAIProvider } from "./mock-provider";
import { GemmaProvider } from "./gemma-provider";
import type { AIProvider } from "./provider";

/** Mock output is an explicit local demo option, never a production fallback
 * for missing credentials or provider outages. */
export const aiProvider: AIProvider = process.env.AI_PROVIDER === "mock" && process.env.NODE_ENV !== "production"
  ? new MockAIProvider()
  : new GemmaProvider();

export type { AIProvider } from "./provider";
export * from "./schemas";
