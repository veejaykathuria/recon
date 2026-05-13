// POST /api/ask
// Body: { question: string, repo_url?: string }
// Steps: (1) Kimchi -> {cypher,view}; (2) validate; (3) Neo4j read; (4) Kimchi -> English answer.

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { chat, KimchiAuthError, KimchiFormatError, KimchiConfigError } from "@/lib/kimchi";
import { runReadOnly } from "@/lib/graph";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Load the recon-schema Tessl Skill at module init for inclusion in the system prompt.
let _schemaSkill: string | null = null;
function loadSchemaSkill(): string {
  if (_schemaSkill !== null) return _schemaSkill;
  const candidates = [
    path.join(process.cwd(), ".tessl", "skills", "recon-schema", "SKILL.md"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _schemaSkill = fs.readFileSync(p, "utf-8");
        return _schemaSkill;
      }
    } catch {}
  }
  _schemaSkill = FALLBACK_SCHEMA;
  return _schemaSkill;
}

const FALLBACK_SCHEMA = `# Recon graph schema
Nodes:
  (:Repo {url, name, sha, analyzed_at})
  (:File {path, language, loc})
  (:Function {qname, name, file_path, start_line, end_line, signature})
  (:Subsystem {name, description, color})
Edges:
  (:File)-[:DEFINED_IN]->(:Repo)
  (:Function)-[:DEFINED_IN]->(:File)
  (:Function)-[:CALLS]->(:Function)
  (:File)-[:IMPORTS]->(:File)
  (:Function)-[:BELONGS_TO]->(:Subsystem)
  (:Subsystem)-[:PART_OF]->(:Repo)
Rules:
- Read-only. Never CREATE/DELETE/MERGE/SET/REMOVE/DROP.
- Always LIMIT to 50.
- Scope every query to a :Repo {url:$repo_url}.
- Modern Cypher 25 syntax.`;

const FEW_SHOTS = `## Few-shot examples
Q: "What are the most-called functions?"
A: {"cypher":"MATCH (f:Function)<-[c:CALLS]-(:Function) WHERE EXISTS { (f)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(:Repo {url:$repo_url}) } RETURN f.qname AS qname, count(c) AS calls ORDER BY calls DESC LIMIT 10","view":"chart"}

Q: "Show me the auth subsystem."
A: {"cypher":"MATCH (s:Subsystem {name:'auth'})-[:PART_OF]->(:Repo {url:$repo_url}) MATCH (fn:Function)-[:BELONGS_TO]->(s) RETURN fn LIMIT 50","view":"graph"}

Q: "Which file imports the most others?"
A: {"cypher":"MATCH (f:File)-[i:IMPORTS]->(:File) WHERE EXISTS { (f)-[:DEFINED_IN]->(:Repo {url:$repo_url}) } RETURN f.path AS path, count(i) AS imports ORDER BY imports DESC LIMIT 10","view":"chart"}`;

const FORBIDDEN = /\b(CREATE|DELETE|MERGE|SET|REMOVE|DROP|CALL\s+db\.|LOAD\s+CSV|FOREACH|DETACH)\b/i;
const HAS_LIMIT = /\bLIMIT\s+\d+\b/i;

interface CypherValidationResult {
  ok: boolean;
  cypher: string;
  reason?: string;
}

function validateCypher(input: string): CypherValidationResult {
  let cypher = (input || "").trim();
  if (!cypher) return { ok: false, cypher, reason: "empty" };
  // Strip code fences if Kimchi wrapped it
  cypher = cypher.replace(/^```(?:cypher)?\s*/i, "").replace(/```$/i, "").trim();

  if (FORBIDDEN.test(cypher)) {
    return { ok: false, cypher, reason: "forbidden_keyword" };
  }
  // Must start with MATCH or WITH (case-insensitive, allow leading whitespace)
  if (!/^\s*(MATCH|WITH)\b/i.test(cypher)) {
    return { ok: false, cypher, reason: "must_start_with_match_or_with" };
  }
  // Auto-append LIMIT 50 if missing
  if (!HAS_LIMIT.test(cypher)) {
    // Remove trailing semicolons
    cypher = cypher.replace(/;\s*$/, "").trim();
    cypher = cypher + "\nLIMIT 50";
  }
  return { ok: true, cypher };
}

async function generateCypher(question: string, repo_url?: string): Promise<{ cypher: string; view: string }> {
  const schema = loadSchemaSkill();
  const repoScope = repo_url
    ? `The user is asking about repo_url="${repo_url}". Use $repo_url as a parameter; do not inline the URL.`
    : `No repo URL is provided; the query may span all repos but still use $repo_url if relevant (pass empty string).`;

  const system =
    `You translate natural-language questions about a Python codebase into a single read-only Cypher query.\n\n` +
    schema +
    `\n\n${FEW_SHOTS}\n\n` +
    `Output a STRICT JSON object: {"cypher": string, "view": "graph"|"list"|"chart"}.\n` +
    `- "view" is "graph" when the answer is a subgraph of nodes/edges, "chart" for aggregate counts/rankings, "list" otherwise.\n` +
    `- The Cypher MUST be read-only (no CREATE/DELETE/MERGE/SET/REMOVE/DROP).\n` +
    `- Always include LIMIT.\n` +
    `- Use $repo_url where appropriate.\n` +
    `${repoScope}\n` +
    `Return ONLY the JSON. No prose, no markdown fences.`;

  const result = await chat({
    system,
    user: question,
    json: true,
    temperature: 0.1,
    maxTokens: 4096,
  });

  if (typeof result === "string") {
    throw new KimchiFormatError("expected JSON from Kimchi", result);
  }
  const obj = result as any;
  const cypher = String(obj.cypher || "").trim();
  const view = ["graph", "list", "chart"].includes(obj.view) ? obj.view : "list";
  return { cypher, view };
}

async function composeAnswer(question: string, cypher: string, data: any[]): Promise<string> {
  // Trim data we feed back so we don't bloat the prompt.
  const preview = data.slice(0, 25);
  const system =
    `You are answering a user's question about a Python codebase. ` +
    `You have already run a Cypher query against a Neo4j graph and received structured rows. ` +
    `Compose a short, plain-English answer (1-3 sentences). ` +
    `Be concrete: reference specific function/file names or counts from the rows. ` +
    `If the rows are empty, say so plainly.`;

  const user = JSON.stringify({
    question,
    cypher,
    rows_preview: preview,
    total_rows: data.length,
  });

  try {
    const text = await chat({
      system,
      user,
      json: false,
      temperature: 0.3,
      maxTokens: 2048,
    });
    return typeof text === "string" ? text.trim() : JSON.stringify(text);
  } catch {
    return data.length === 0
      ? "No matching results found in this repo."
      : `Returned ${data.length} row${data.length === 1 ? "" : "s"}.`;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const question = (body?.question || "").toString().trim();
  const repo_url = body?.repo_url ? String(body.repo_url).trim() : "";
  if (!question) {
    return NextResponse.json({ error: "missing_question" }, { status: 400 });
  }

  // 1. Generate Cypher (with one retry on format error)
  let cypher: string;
  let view: string;
  try {
    ({ cypher, view } = await generateCypher(question, repo_url));
  } catch (err: any) {
    if (err instanceof KimchiAuthError) {
      return NextResponse.json(
        { error: "kimchi_auth", hint: "check KIMCHI_API_KEY" },
        { status: 502 }
      );
    }
    if (err instanceof KimchiConfigError) {
      return NextResponse.json(
        { error: "kimchi_config", message: err.message },
        { status: 500 }
      );
    }
    if (err instanceof KimchiFormatError) {
      try {
        ({ cypher, view } = await generateCypher(question, repo_url));
      } catch (err2: any) {
        return NextResponse.json(
          { error: "kimchi_format" },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "kimchi_error", message: err?.message || String(err) },
        { status: 502 }
      );
    }
  }

  // 2. Validate Cypher
  const validated = validateCypher(cypher);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "invalid_cypher", cypher, reason: validated.reason },
      { status: 400 }
    );
  }
  const finalCypher = validated.cypher;

  // 3. Run against Neo4j with $repo_url param
  let data: any[];
  try {
    const params: Record<string, any> = { repo_url };
    data = await runReadOnly(finalCypher, params);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (/timed out/i.test(msg) || /timeout/i.test(msg)) {
      return NextResponse.json(
        { error: "timeout", cypher: finalCypher },
        { status: 504 }
      );
    }
    if (/auth/i.test(msg)) {
      return NextResponse.json(
        { error: "neo4j_auth", hint: "check NEO4J credentials" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "neo4j_read", message: msg, cypher: finalCypher },
      { status: 500 }
    );
  }

  // 4. Compose English answer
  const answer = await composeAnswer(question, finalCypher, data);

  return NextResponse.json({
    cypher: finalCypher,
    view,
    answer,
    data,
  });
}
