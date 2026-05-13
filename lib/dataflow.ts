// Render a simple ASCII dataflow diagram for the analyzed repo.
//
// We query Neo4j for cross-subsystem CALLS aggregates: for each pair of
// subsystems (A -> B) where some function in A calls some function in B,
// sum the call count. Then we render boxes for each subsystem plus the
// top edges between them, in plain ASCII (no Unicode box-drawing chars).
//
// The output is meant to be readable in a chat box and copy-pasteable
// into a README or a Slack message.

import { runReadOnly } from "./graph";
import { chat, KimchiAuthError, KimchiConfigError } from "./kimchi";

interface Subsystem {
  name: string;
  function_count: number;
  description?: string;
}

interface Edge {
  src: string;
  dst: string;
  weight: number;
}

export interface DataflowResult {
  ascii: string;
  narrative: string;
  edges: Edge[];
}

const EDGE_QUERY = `
MATCH (a:Subsystem)-[:PART_OF]->(:Repo {url:$repo_url})
MATCH (b:Subsystem)-[:PART_OF]->(:Repo {url:$repo_url})
WHERE a <> b
MATCH (fa:Function)-[:BELONGS_TO]->(a)
MATCH (fb:Function)-[:BELONGS_TO]->(b)
MATCH (fa)-[c:CALLS]->(fb)
RETURN a.name AS src, b.name AS dst, count(c) AS weight
ORDER BY weight DESC
LIMIT 24
`;

function pad(str: string, width: number, ch = " "): string {
  if (str.length >= width) return str.slice(0, width);
  return str + ch.repeat(width - str.length);
}

function center(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  const total = width - str.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

function box(label: string, sub: string): string[] {
  // Returns 3 lines representing a small ASCII box.
  const inner = Math.max(label.length, sub.length) + 2;
  const top = "+" + "-".repeat(inner) + "+";
  const mid = "|" + center(label, inner) + "|";
  const bot = "|" + center(sub, inner) + "|";
  const end = "+" + "-".repeat(inner) + "+";
  return [top, mid, bot, end];
}

function buildAscii(subsystems: Subsystem[], edges: Edge[]): string {
  const lines: string[] = [];
  lines.push("Subsystems (function counts):");
  lines.push("");

  const sorted = subsystems.slice().sort((a, b) => b.function_count - a.function_count);
  const perRow = 4;
  for (let i = 0; i < sorted.length; i += perRow) {
    const slice = sorted.slice(i, i + perRow);
    const boxes = slice.map((s) => box(s.name, `${s.function_count} fns`));
    const rowCount = boxes[0].length;
    for (let r = 0; r < rowCount; r++) {
      lines.push(boxes.map((b) => b[r]).join("  "));
    }
    lines.push("");
  }

  if (edges.length === 0) {
    lines.push("Cross-subsystem call edges: (none detected)");
    return lines.join("\n");
  }

  lines.push("Top cross-subsystem call edges:");
  lines.push("");
  const maxName = Math.max(
    8,
    ...edges.flatMap((e) => [e.src.length, e.dst.length])
  );
  const maxWeight = edges[0].weight;
  const barWidth = 24;
  for (const e of edges.slice(0, 12)) {
    const bar = "#".repeat(Math.max(1, Math.round((e.weight / maxWeight) * barWidth)));
    lines.push(
      `  ${pad(e.src, maxName)}  -->  ${pad(e.dst, maxName)}   ${pad(bar, barWidth)}  ${e.weight}`
    );
  }
  return lines.join("\n");
}

async function generateNarrative(
  repoName: string,
  subsystems: Subsystem[],
  edges: Edge[]
): Promise<string> {
  if (subsystems.length === 0) return "";

  // Compact payload for the model: subsystem stats + top edges only.
  const payload = {
    repo: repoName,
    subsystems: subsystems
      .slice()
      .sort((a, b) => b.function_count - a.function_count)
      .map((s) => ({
        name: s.name,
        functions: s.function_count,
        description: s.description || "",
      })),
    top_edges: edges.slice(0, 12).map((e) => ({
      from: e.src,
      to: e.dst,
      calls: e.weight,
    })),
  };

  const system =
    `You write a short narrative summary of the runtime DATAFLOW of a Python ` +
    `codebase, given its subsystem decomposition and top cross-subsystem CALLS ` +
    `edges. Each edge "from -> to" means functions in <from> call functions in <to>.\n\n` +
    `STRICT OUTPUT RULES:\n` +
    `- 3 to 5 plain prose sentences. No bullets, no markdown, no headings.\n` +
    `- No internal monologue, no "let me think", no reasoning trace — only the answer.\n` +
    `- Name specific subsystems and quantities (e.g. "requests-api with 8 functions").\n` +
    `- Cover (in order): the likely entry-point subsystem; the chain a typical request ` +
    `traverses; which subsystems are central hubs and which are leaves.\n` +
    `- Skip filler like "this codebase is well-organized".`;

  // Prefer a non-thinking model. Kimi K2.5 spends its token budget on reasoning
  // and the final answer ends up truncated or buried; nemotron-3-super-fp4
  // returns the answer in `content` directly.
  const modelOverride =
    process.env.KIMCHI_NARRATIVE_MODEL || process.env.KIMCHI_CLUSTER_MODEL || undefined;

  try {
    const text = await chat({
      system,
      user: JSON.stringify(payload),
      json: false,
      temperature: 0.3,
      maxTokens: 768,
      model: modelOverride,
    });
    const out = typeof text === "string" ? text.trim() : "";
    return cleanNarrative(out);
  } catch (err) {
    if (err instanceof KimchiAuthError || err instanceof KimchiConfigError) throw err;
    // Format errors, timeouts, etc — degrade silently with a minimal fallback.
    return fallbackNarrative(subsystems, edges);
  }
}

function cleanNarrative(s: string): string {
  if (!s) return "";
  // Strip common thinking-model artifacts in case a thinking model leaks through.
  let t = s;
  t = t.replace(/<\/?think[^>]*>/gi, "");
  t = t.replace(/^(?:okay|alright|let me think|let's see|the user wants[^.]*\.)/i, "");
  // If the model wrote a multi-paragraph chain-of-thought, keep only the last
  // paragraph (the actual answer typically sits at the bottom).
  const paragraphs = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    // Heuristic: pick the longest paragraph that doesn't start with "wait" / "actually" / a list marker.
    const candidates = paragraphs.filter(
      (p) => !/^(?:wait|actually|hmm|so,|let me|but |looking)/i.test(p) && !/^[-*\d]/.test(p)
    );
    t = (candidates.length ? candidates[candidates.length - 1] : paragraphs[paragraphs.length - 1]);
  }
  return t.trim();
}

function fallbackNarrative(subsystems: Subsystem[], edges: Edge[]): string {
  const sorted = subsystems.slice().sort((a, b) => b.function_count - a.function_count);
  const biggest = sorted[0];
  const inDegree = new Map<string, number>();
  for (const e of edges) inDegree.set(e.dst, (inDegree.get(e.dst) || 0) + e.weight);
  const topHub = [...inDegree.entries()].sort((a, b) => b[1] - a[1])[0];
  const parts: string[] = [];
  parts.push(`${biggest?.name || "the largest subsystem"} holds ${biggest?.function_count || 0} functions, the most of any cluster.`);
  if (edges[0]) {
    parts.push(`The hottest call edge is ${edges[0].src} -> ${edges[0].dst} (${edges[0].weight} calls).`);
  }
  if (topHub) {
    parts.push(`${topHub[0]} receives the most cross-subsystem calls, with ${topHub[1]} inbound.`);
  }
  return parts.join(" ");
}

export async function renderDataflow(
  repoUrl: string,
  repoName: string,
  subsystems: Subsystem[]
): Promise<DataflowResult> {
  if (!subsystems || subsystems.length === 0) {
    return {
      ascii: "(no subsystems — re-run analyze to populate)",
      narrative: "",
      edges: [],
    };
  }

  let edges: Edge[] = [];
  try {
    const rows = await runReadOnly(EDGE_QUERY, { repo_url: repoUrl });
    edges = rows
      .map((r: any) => ({
        src: String(r.src || ""),
        dst: String(r.dst || ""),
        weight: Number(r.weight || 0),
      }))
      .filter((e) => e.src && e.dst && e.weight > 0);
  } catch {
    edges = [];
  }

  const ascii = buildAscii(subsystems, edges);
  const narrative = await generateNarrative(repoName, subsystems, edges);
  return { ascii, narrative, edges };
}

// Back-compat shim for callers that only need the ASCII.
export async function renderDataflowAscii(
  repoUrl: string,
  subsystems: Subsystem[]
): Promise<string> {
  const r = await renderDataflow(repoUrl, "", subsystems);
  return r.ascii;
}
