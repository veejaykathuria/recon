// Thin Kimchi (OpenAI-compatible) client wrapper.
// Reads KIMCHI_BASE_URL / KIMCHI_API_KEY / KIMCHI_MODEL from env.
//
// Exports:
//   chat({ system, user, json }) -> string | object
//   KimchiAuthError, KimchiFormatError, KimchiConfigError

import OpenAI from "openai";

export class KimchiAuthError extends Error {
  constructor(message = "Kimchi authentication failed (401)") {
    super(message);
    this.name = "KimchiAuthError";
  }
}

export class KimchiFormatError extends Error {
  raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "KimchiFormatError";
    this.raw = raw;
  }
}

export class KimchiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KimchiConfigError";
  }
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  const baseURL = process.env.KIMCHI_BASE_URL;
  const apiKey = process.env.KIMCHI_API_KEY;
  if (!baseURL) throw new KimchiConfigError("KIMCHI_BASE_URL not set");
  if (!apiKey) throw new KimchiConfigError("KIMCHI_API_KEY not set");
  _client = new OpenAI({ baseURL, apiKey });
  return _client;
}

export interface ChatOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Run a single chat completion.
 * If `json: true`, the result is parsed and returned as an object.
 * Otherwise the raw assistant text is returned.
 */
export async function chat(opts: ChatOptions): Promise<string | Record<string, any>> {
  const client = getClient();
  const model = opts.model || process.env.KIMCHI_MODEL || "kimi-k2.5";

  let response;
  try {
    response = await client.chat.completions.create({
      model,
      temperature: opts.temperature ?? 0.2,
      // Thinking models (kimi-k2.5 etc.) spend tokens on reasoning_content before
      // emitting content. Give them generous headroom by default.
      max_tokens: opts.maxTokens ?? 8192,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      // Best-effort: many OpenAI-compatible servers honor this; harmless if ignored.
      ...(opts.json
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    if (status === 401) throw new KimchiAuthError();
    throw err;
  }

  const msg: any = response?.choices?.[0]?.message ?? {};
  // Some thinking-model gateways put structured output in `reasoning_content`
  // when generation was cut short or the model emits JSON inside its thinking.
  let text: string = msg.content ?? "";
  if (!text && typeof msg.reasoning_content === "string") {
    text = msg.reasoning_content;
  }

  if (!opts.json) return text;

  // Try direct JSON parse, then a fenced-block extraction fallback.
  const parsed = tryParseJson(text);
  if (parsed !== undefined) return parsed;

  throw new KimchiFormatError("Kimchi did not return valid JSON", text);
}

function tryParseJson(text: string): any | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  // Strip ```json ... ``` fences if present
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }

  // Last resort: grab first {...} or [...] block
  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  let start = -1;
  if (objStart === -1) start = arrStart;
  else if (arrStart === -1) start = objStart;
  else start = Math.min(objStart, arrStart);
  if (start >= 0) {
    const open = trimmed[start];
    const close = open === "{" ? "}" : "]";
    const end = trimmed.lastIndexOf(close);
    if (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {}
    }
  }
  return undefined;
}
