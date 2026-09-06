/**
 * Pluggable AI provider (server-only).
 *
 * Defaults to OpenRouter's free, OpenAI-compatible endpoint, but works with any
 * OpenAI-compatible chat/completions API (OpenAI, Azure OpenAI, NVIDIA NIM, Ollama,
 * LM Studio, vLLM) selected purely through environment variables — no vendor is
 * hard-coded:
 *
 *   AI_API_KEY        API key (absence disables AI; heuristic fallbacks still work)
 *   AI_BASE_URL       default https://openrouter.ai/api/v1 (OpenRouter)
 *   AI_MODEL          text model, default nvidia/nemotron-3.5-lightning:free
 *   AI_VISION_MODEL   vision model, default google/gemma-4-31b-it:free
 *   AI_SITE_URL       optional — sent as HTTP-Referer (OpenRouter attribution)
 *   AI_SITE_NAME      optional — sent as X-Title (OpenRouter attribution)
 *   AI_JSON_MODE      "on" to send response_format:json_object (off by default, as
 *                     many free/open models reject it; JSON is parsed leniently)
 *   AI_MAX_TOKENS     max completion tokens, default 2048
 *   AI_TIMEOUT_MS     per-request timeout before abort+retry, default 90000
 *   AI_BINDING_RANKING "on" to re-rank binding suggestions with the text model
 *                     (off by default — heuristics only)
 *
 * Resilience: free-tier models frequently rotate, cold-start, or get rate-limited
 * (429). AI_MODEL/AI_VISION_MODEL are tried first, then a curated list of
 * verified-live fallbacks, so one flaky/retired model never hard-fails a feature.
 */

const BASE_URL = process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1';
const API_KEY = process.env.AI_API_KEY ?? '';
const SITE_URL = process.env.AI_SITE_URL ?? '';
const SITE_NAME = process.env.AI_SITE_NAME ?? 'Tax Form Layer';
const JSON_MODE = process.env.AI_JSON_MODE === 'on';
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? '2048');
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? '90000');
const BINDING_RANKING = process.env.AI_BINDING_RANKING === 'on';

const TEXT_MODELS = dedupe([
  process.env.AI_MODEL,
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'z-ai/glm-5.2:free',
  'minimax/minimax-m2.7:free',
]);
const VISION_MODELS = dedupe([
  process.env.AI_VISION_MODEL,
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'minimax/minimax-m3:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
]);

function dedupe(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim()))));
}

export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

export function isBindingRankingEnabled(): boolean {
  return BINDING_RANKING && isConfigured();
}

interface ChatOptions {
  temperature?: number;
  json?: boolean;
  vision?: boolean;
  maxTokens?: number;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

function isNoEndpointsError(status: number, detail: string): boolean {
  return status === 404 && /no endpoints found/i.test(detail);
}

class ModelUnavailableError extends Error {
  constructor(
    public model: string,
    reason: string,
  ) {
    super(`Model "${model}" unavailable: ${reason}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  const wantsJsonFormat = Boolean(opts.json) && JSON_MODE && !opts.vision;
  const body = JSON.stringify({
    model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    stream: false,
    messages,
    ...(wantsJsonFormat ? { response_format: { type: 'json_object' } } : {}),
  });

  // Retry once in-place on timeout, rate-limit (429), or transient 5xx — free-tier
  // model pools can be momentarily busy or cold-starting. If it's still failing
  // after the retry, throw ModelUnavailableError so `chat()` moves to the next
  // candidate model rather than failing the whole request.
  let lastDetail = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      if (attempt > 0) await sleep(500 * attempt); // brief backoff before retrying
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          // OpenRouter attribution headers (optional; ignored by other providers).
          ...(SITE_URL ? { 'HTTP-Referer': SITE_URL } : {}),
          ...(SITE_NAME ? { 'X-Title': SITE_NAME } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        lastDetail = detail;
        if (isNoEndpointsError(res.status, detail)) {
          throw new ModelUnavailableError(model, 'no live endpoints');
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt === 0) continue; // one quick retry
          throw new ModelUnavailableError(model, `still failing after retry (${res.status})`);
        }
        throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      if (err instanceof ModelUnavailableError) throw err;
      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted && attempt === 0) continue; // retry once after timeout
      if (aborted) {
        throw new ModelUnavailableError(model, `timed out after ${Math.round(TIMEOUT_MS / 1000)}s`);
      }
      throw err instanceof Error ? err : new Error('AI request failed');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ModelUnavailableError(model, lastDetail.slice(0, 200) || 'unknown error');
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!isConfigured()) throw new Error('AI provider is not configured (set AI_API_KEY).');

  const candidates = opts.vision ? VISION_MODELS : TEXT_MODELS;
  if (candidates.length === 0) {
    throw new Error('No AI model configured (set AI_MODEL / AI_VISION_MODEL).');
  }

  let lastError: unknown;
  for (const model of candidates) {
    try {
      const result = await callModel(model, messages, opts);
      console.log(`[ai] model responded: ${model}`);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[ai] model failed: ${model}`, err instanceof Error ? err.message : err);
      if (err instanceof ModelUnavailableError) continue; // try next candidate
      throw err; // non-availability failure (bad request, auth, etc.) — surface directly
    }
  }
  throw new Error(
    `No configured model is currently available (tried: ${candidates.join(', ')}). ` +
      `Free-tier availability rotates — check https://openrouter.ai/models?max_price=0 and update AI_MODEL/AI_VISION_MODEL, or add your own OpenRouter key at https://openrouter.ai/settings/integrations to raise rate limits.` +
      (lastError instanceof Error ? ` Last error: ${lastError.message}` : ''),
  );
}

function closeJson(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const c of s) {
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if ((c === '}' || c === ']') && stack.length) stack.pop();
  }
  return s + stack.reverse().join('');
}

export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<T> {
  const raw = await chat(messages, { ...opts, json: true });
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }

  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  const slice = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try { return JSON.parse(slice) as T; } catch { /* fall through */ }
  try { return JSON.parse(closeJson(slice)) as T; } catch { /* fall through */ }

  throw new Error('AI did not return valid JSON.');
}

export const aiModels = { text: TEXT_MODELS[0], vision: VISION_MODELS[0] };
