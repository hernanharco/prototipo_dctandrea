import type { ChatMessage } from "./prompt.js";

/**
 * Gemini REST client (v1beta) with retry/backoff and graceful no-key fallback.
 *
 * - Reads `GEMINI_API_KEY` and `GEMINI_MODEL` from the environment. The key is
 *   NEVER hard-coded or committed (see .env.example / backend README).
 * - Retries HTTP 429 / 503 with backoff 2s / 5s / 10s (three attempts total).
 * - When no API key is configured, returns a graceful fallback instead of
 *   erroring (spec: "Missing API key" scenario).
 * - `fetch` and `sleep` are injectable for tests.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

/** Retry/backoff schedule in milliseconds for transient errors (429/503). */
export const RETRY_BACKOFF_MS = [2000, 5000, 10000];

export interface GeminiGenerateInput {
  systemPrompt: string;
  messages: ChatMessage[];
}

export interface GeminiClient {
  /** Returns the generated text reply. Throws only after retries are exhausted. */
  generate(input: GeminiGenerateInput): Promise<string>;
  /** True when an API key is configured. */
  isConfigured(): boolean;
}

export type FetchLike = (url: string, init: unknown) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
export type SleepLike = (ms: number) => Promise<void>;

export interface GeminiDeps {
  apiKey?: string;
  model?: string;
  fetch?: FetchLike;
  sleep?: SleepLike;
}

const sleepDefault: SleepLike = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FALLBACK_REPLY =
  "El asistente está temporalmente sin conexión con el motor de recomendación. " +
  "Por favor, inténtelo de nuevo más tarde. Recuerde que este asistente ofrece " +
  "orientación general de prevención y no sustituye la consulta médica.";

export function createGeminiClient(deps: GeminiDeps = {}): GeminiClient {
  const apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY;
  const model = deps.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const fetchFn: FetchLike =
    deps.fetch ?? ((url, init) => globalThis.fetch(url as string, init as RequestInit) as ReturnType<FetchLike>);
  const sleepFn: SleepLike = deps.sleep ?? sleepDefault;

  async function requestWithRetry(body: unknown): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-goog-api-key"] = apiKey;
    }

    let lastError: Error | null = null;
    // Attempt 1 immediate; subsequent attempts back off 2s / 5s / 10s.
    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
      if (attempt > 0) {
        await sleepFn(RETRY_BACKOFF_MS[attempt - 1]!);
      }
      const res = await fetchFn(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
        lastError = new Error("gemini: empty response payload");
        continue;
      }
      if (res.status === 429 || res.status === 503) {
        lastError = new Error(`gemini: transient HTTP ${res.status}`);
        continue; // back off and retry
      }
      throw new Error(`gemini: non-retryable HTTP ${res.status}`);
    }
    throw lastError ?? new Error("gemini: request failed");
  }

  return {
    isConfigured(): boolean {
      return Boolean(apiKey);
    },
    async generate(input: GeminiGenerateInput): Promise<string> {
      if (!apiKey) {
        return FALLBACK_REPLY;
      }
      const contents = input.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      return requestWithRetry({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.3 },
      });
    },
  };
}