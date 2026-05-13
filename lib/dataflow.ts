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

interface Subsystem {
  name: string;
  function_count: number;
}

interface Edge {
  src: string;
  dst: string;
  weight: number;
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

export async function renderDataflowAscii(
  repoUrl: string,
  subsystems: Subsystem[]
): Promise<string> {
  if (!subsystems || subsystems.length === 0) {
    return "(no subsystems — re-run analyze to populate)";
  }

  // Fetch the cross-subsystem edge weights.
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

  const lines: string[] = [];
  lines.push("Subsystems (function counts):");
  lines.push("");

  // Render boxes in rows of up to 4.
  const sorted = subsystems.slice().sort((a, b) => b.function_count - a.function_count);
  const perRow = 4;
  for (let i = 0; i < sorted.length; i += perRow) {
    const slice = sorted.slice(i, i + perRow);
    const boxes = slice.map((s) => box(s.name, `${s.function_count} fns`));
    const rows = boxes[0].length;
    for (let r = 0; r < rows; r++) {
      lines.push(boxes.map((b) => b[r]).join("  "));
    }
    lines.push("");
  }

  if (edges.length === 0) {
    lines.push("Cross-subsystem call edges: (none detected)");
    return lines.join("\n");
  }

  // Render top edges as plain ASCII arrows.
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
