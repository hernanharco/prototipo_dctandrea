import { describe, it, expect, vi } from "vitest";
import { createGeminiClient, RETRY_BACKOFF_MS, DEFAULT_GEMINI_MODEL } from "../src/agent/gemini.js";

const base = {
  systemPrompt: "system",
  messages: [{ role: "user" as const, content: "hola" }],
};

/** Builds a fake fetch that returns a scripted sequence of statuses. */
function scriptedFetch(statuses: Array<{ status: number; body?: unknown }>): {
  fetch: (url: string, init: unknown) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;
  calls: Array<{ url: string; init: unknown }>;
} {
  const calls: Array<{ url: string; init: unknown }> = [];
  let i = 0;
  const fetch = async (url: string, init: unknown) => {
    calls.push({ url, init });
    const step = statuses[Math.min(i, statuses.length - 1)]!;
    i += 1;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.body ?? {},
    };
  };
  return { fetch, calls };
}

describe("gemini retry/backoff + graceful fallback", () => {
  it("retries with backoff 2s/5s/10s on 429 and succeeds on the third attempt", async () => {
    const sleep = vi.fn(async () => undefined);
    const { fetch, calls } = scriptedFetch([
      { status: 429 },
      { status: 503 },
      { status: 200, body: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } },
    ]);
    const gemini = createGeminiClient({ apiKey: "test-key", model: "gemini-test", fetch, sleep });

    const reply = await gemini.generate(base);

    expect(reply).toBe("ok");
    expect(calls.length).toBe(3);
    // Backoff schedule: sleep called before retries 2 and 3 with 2s and 5s.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 5000]);
    expect(RETRY_BACKOFF_MS).toEqual([2000, 5000, 10000]);
    // Uses REST v1beta endpoint + model.
    expect(calls[0]!.url).toContain("/v1beta/models/gemini-test:generateContent");
    // Key goes in header, never in the URL.
    expect(calls[0]!.url).not.toContain("test-key");
  });

  it("throws after 429/503 retries are exhausted", async () => {
    const sleep = vi.fn(async () => undefined);
    const { fetch } = scriptedFetch([{ status: 503 }, { status: 429 }, { status: 503 }, { status: 429 }]);
    const gemini = createGeminiClient({ apiKey: "test-key", model: "gemini-test", fetch, sleep });

    await expect(gemini.generate(base)).rejects.toThrow(/gemini/);
    // 3 retry sleeps (2s/5s/10s) after the initial attempt.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 5000, 10000]);
  });

  it("throws immediately on a non-retryable status", async () => {
    const sleep = vi.fn(async () => undefined);
    const { fetch } = scriptedFetch([{ status: 400 }]);
    const gemini = createGeminiClient({ apiKey: "test-key", model: "gemini-test", fetch, sleep });

    await expect(gemini.generate(base)).rejects.toThrow(/non-retryable HTTP 400/);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("falls back gracefully when no API key is configured (no fetch)", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("should not be called");
    });
    const gemini = createGeminiClient({ fetch, sleep: async () => undefined });

    expect(gemini.isConfigured()).toBe(false);
    const reply = await gemini.generate(base);
    expect(reply).toContain("temporalmente sin conexión");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("defaults the model to the documented constant", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-1.5-flash");
  });
});