// One shared Gemini client for the whole app.
//
// Why this exists: the free tier caps requests per minute per model (15 for
// gemini-3.1-flash-lite). Extraction, consolidation and the benchmark judge all
// draw on that same quota, so the pacing has to live in one place that every
// call goes through. Per call site limiters would each think they were under
// the limit while together they were over it.

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export const modelName = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// Sit under the real limit. A run that opens with a burst can trip 15/min even
// when the average is fine, and one 429 costs more wall clock than the gaps do.
const RPM = Number(process.env.GEMINI_RPM || 12);
const MIN_GAP_MS = Math.ceil(60_000 / RPM);
const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 5);

export interface GenerateOptions {
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Earliest moment the next request may start. Callers claim their slot
// synchronously before awaiting, so two concurrent callers get two different
// slots instead of both reading the same "now" and firing together.
let nextSlot = 0;

async function takeSlot(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_GAP_MS;
  if (start > now) await sleep(start - now);
}

// A 429 is a fact about the project's quota, not about this one request, so
// hold everybody back. Backing off only the failing call would send the next
// queued call straight into the same wall.
function backoffAll(ms: number): void {
  nextSlot = Math.max(nextSlot, Date.now() + ms);
}

const message = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? "");

// The SDK rejects with plain objects carrying a numeric `status`, not always an
// Error, so read it defensively rather than asserting a shape.
function statusOf(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return 0;
}

function isRateLimit(err: unknown): boolean {
  const m = message(err);
  return statusOf(err) === 429 || m.includes("[429") || /RESOURCE_EXHAUSTED/.test(m);
}

// A per day quota will not free up for hours, so retrying it is just a slower
// crash with a worse error message. Fail immediately and say what to do.
function isDailyQuota(err: unknown): boolean {
  return /PerDay|per_day|RequestsPerDay/i.test(message(err));
}

function isTransient(err: unknown): boolean {
  const m = message(err);
  return (
    statusOf(err) >= 500 ||
    /\[50\d|overloaded|UNAVAILABLE|ECONNRESET|ETIMEDOUT|fetch failed/i.test(m)
  );
}

// Gemini tells us how long to wait, both as a retryDelay field and in prose.
// Its number beats our guess, so use it when it is there.
function serverRetryMs(err: unknown): number | null {
  const m = message(err);
  const hit = m.match(/"retryDelay"\s*:\s*"([\d.]+)s"/) ?? m.match(/retry in ([\d.]+)\s*s/i);
  return hit?.[1] ? Math.ceil(parseFloat(hit[1]) * 1000) + 500 : null;
}

// Send one prompt, paced and retried. Returns the raw response text.
export async function generate(prompt: string, { label = "gemini" }: GenerateOptions = {}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });

  for (let attempt = 0; ; attempt++) {
    await takeSlot();
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: unknown) {
      if (isDailyQuota(err)) {
        throw new Error(
          `Gemini daily free tier quota is used up for ${modelName}. Wait for the ` +
            `daily reset, switch to another API key, or enable billing on the project.`
        );
      }
      if (!(isRateLimit(err) || isTransient(err)) || attempt >= MAX_RETRIES) throw err;

      const wait = serverRetryMs(err) ?? Math.min(60_000, 2_000 * 2 ** attempt);
      backoffAll(wait);
      console.warn(
        `[${label}] ${isRateLimit(err) ? "rate limited" : "transient error"}, waiting ` +
          `${Math.round(wait / 1000)}s (attempt ${attempt + 1} of ${MAX_RETRIES})`
      );
      await sleep(wait);
    }
  }
}

// Every prompt in this app asks for strict JSON, and the model still wraps it in
// a code fence sometimes. Strip the fence and parse in one place. Throws on
// unparseable output so each caller can apply its own fallback.
//
// Returns unknown by default: the model's output is not typed just because we
// asked nicely, so callers narrow it themselves.
export async function generateJson<T = unknown>(prompt: string, opts?: GenerateOptions): Promise<T> {
  const raw = await generate(prompt, opts);
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
