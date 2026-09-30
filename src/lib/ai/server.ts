import "server-only";
import { serverEnv } from "@/config/env.server";
import { createAnthropicProvider } from "./anthropic";
import type { AiProvider } from "./provider";

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** Returns the provider, or null when no key is configured (the UI then says "not connected"). */
export function getAiProvider(): AiProvider | null {
  const apiKey = serverEnv.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return createAnthropicProvider({ apiKey, model: serverEnv.AI_MODEL ?? DEFAULT_MODEL });
}

export function isAiConfigured(): boolean {
  return Boolean(serverEnv.ANTHROPIC_API_KEY);
}
