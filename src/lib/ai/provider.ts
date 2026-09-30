export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(req: AiRequest, signal?: AbortSignal): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(
    readonly kind: "auth" | "rate_limit" | "overloaded" | "bad_response" | "network" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
