import { AiProviderError, type AiProvider, type AiRequest } from "./provider";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Minimal Anthropic Messages API adapter over plain fetch. The key stays on
 * the server; the response is reduced to text and never executed or rendered
 * as markup.
 */
export function createAnthropicProvider(opts: AnthropicOptions): AiProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    name: "anthropic",
    async complete(req: AiRequest, signal?: AbortSignal): Promise<string> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25_000);
      const onAbort = () => ctrl.abort();
      signal?.addEventListener("abort", onAbort);
      let res: Response;
      try {
        res = await doFetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": VERSION },
          body: JSON.stringify({
            model: opts.model,
            max_tokens: req.maxTokens ?? 900,
            temperature: req.temperature ?? 0.2,
            system: req.system,
            messages: req.messages,
          }),
          signal: ctrl.signal,
        });
      } catch (e) {
        if (ctrl.signal.aborted) throw new AiProviderError("timeout", "The assistant took too long to answer.");
        throw new AiProviderError("network", e instanceof Error ? e.message : "Network error");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }

      if (res.status === 401 || res.status === 403) throw new AiProviderError("auth", "The AI provider rejected the key.");
      if (res.status === 429) throw new AiProviderError("rate_limit", "The AI provider is rate limiting us.");
      if (res.status === 529 || res.status >= 500) throw new AiProviderError("overloaded", "The AI provider is busy.");
      if (!res.ok) throw new AiProviderError("bad_response", `Unexpected status ${res.status}`);

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new AiProviderError("bad_response", "Unreadable response.");
      }
      const content = (body as { content?: unknown }).content;
      if (!Array.isArray(content)) throw new AiProviderError("bad_response", "No content in response.");
      const text = content
        .filter((b): b is { type: "text"; text: string } => !!b && (b as { type?: unknown }).type === "text" && typeof (b as { text?: unknown }).text === "string")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new AiProviderError("bad_response", "Empty response.");
      return text;
    },
  };
}
