// Cluster function qnames into 3-8 subsystems via a single Kimchi call.

import { chat, KimchiFormatError } from "./kimchi";

export interface Subsystem {
  name: string;
  description: string;
  color: string; // hex like #ff8800
  qnames: string[];
}

const SYSTEM_PROMPT = `You are a senior software architect tasked with grouping Python functions into coherent subsystems.

You will receive a JSON array of fully-qualified function names (qname format: "module.path:Class.method" or "module.path:fn_name").
Group them into 3 to 8 subsystems based on what they appear to do (auth, parsing, networking, IO, models, utils, cli, tests, etc.).

Rules:
- Return STRICT JSON ONLY (no prose, no markdown fences).
- Schema:
  { "subsystems": [ { "name": string, "description": string, "color": string, "qnames": string[] } ] }
- "name" must be short (1-3 words), kebab/lower-case e.g. "auth", "http-client", "data-models".
- "description" must be one sentence, <= 120 chars.
- "color" must be a 7-char hex string like "#3b82f6". Use visually distinct colors per subsystem.
- Every qname from the input must appear in exactly one subsystem.
- Do not invent qnames that were not in the input.
- Prefer 4-6 subsystems unless the codebase clearly has fewer or more.`;

export async function clusterFunctions(qnames: string[]): Promise<Subsystem[]> {
  if (!qnames || qnames.length === 0) return [];

  // Cap to keep prompt size sane; Kimi 262k window can easily hold this but no need to send giant lists.
  const capped = qnames.slice(0, 5000);

  const user = JSON.stringify({ qnames: capped });

  let result: any;
  try {
    result = await chat({
      system: SYSTEM_PROMPT,
      user,
      json: true,
      temperature: 0.2,
      maxTokens: 12000,
    });
  } catch (err) {
    if (err instanceof KimchiFormatError) {
      // Retry once with stricter framing
      result = await chat({
        system: SYSTEM_PROMPT + "\n\nReturn ONLY a JSON object. Do not include any other text.",
        user,
        json: true,
        temperature: 0,
        maxTokens: 12000,
      });
    } else {
      throw err;
    }
  }

  const raw = (result && typeof result === "object" && Array.isArray((result as any).subsystems))
    ? (result as any).subsystems
    : Array.isArray(result) ? result : [];

  const seen = new Set<string>();
  const valid = new Set<string>(capped);
  const out: Subsystem[] = [];

  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const name = String(s.name || "").trim();
    const description = String(s.description || "").trim();
    const color = normalizeColor(s.color);
    const list: string[] = Array.isArray(s.qnames) ? s.qnames.filter((q: any) => typeof q === "string") : [];
    const filtered: string[] = [];
    for (const q of list) {
      if (valid.has(q) && !seen.has(q)) {
        seen.add(q);
        filtered.push(q);
      }
    }
    if (name && filtered.length > 0) {
      out.push({ name, description, color, qnames: filtered });
    }
  }

  // Any leftover qnames -> bucket into "uncategorized"
  const leftovers = capped.filter((q) => !seen.has(q));
  if (leftovers.length > 0) {
    out.push({
      name: "uncategorized",
      description: "Functions the clusterer did not assign to a named subsystem.",
      color: "#9ca3af",
      qnames: leftovers,
    });
  }

  return out;
}

function normalizeColor(c: any): string {
  const s = String(c || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    // expand short form
    const r = s[1], g = s[2], b = s[3];
    return ("#" + r + r + g + g + b + b).toLowerCase();
  }
  // fallback palette
  const palette = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  // hash-pick by string for stability
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
