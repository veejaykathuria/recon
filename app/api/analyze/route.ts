// POST /api/analyze
// Body: { repo_url: string }
// Steps: clone -> parse -> cluster (Kimchi) -> push to Neo4j -> return counts/subsystems.

import { NextRequest, NextResponse } from "next/server";
import { clusterFunctions, type Subsystem } from "@/lib/cluster";
import { pushToNeo4j, type ParsedRepo } from "@/lib/graph";
import { KimchiAuthError, KimchiFormatError, KimchiConfigError } from "@/lib/kimchi";
import { cloneRepo } from "@/lib/clone";
import { parsePythonRepo } from "@/lib/parse_python";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const repo_url = (body?.repo_url || "").toString().trim();
  if (!repo_url || !/^https?:\/\//i.test(repo_url)) {
    return NextResponse.json({ error: "invalid_repo_url" }, { status: 400 });
  }

  // 1. Clone (pure TS — works on Vercel; git CLI is available in functions)
  let clonePath: string;
  let cloneName: string;
  let cloneSha: string;
  try {
    const result = await cloneRepo(repo_url);
    clonePath = result.path;
    cloneName = result.name;
    cloneSha = result.sha;
  } catch (err: any) {
    return NextResponse.json(
      { error: "clone_failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }

  // 2. Parse (pure TS — regex-based Python extractor, no python3 dependency)
  let parsed: ParsedRepo;
  try {
    parsed = parsePythonRepo(clonePath, {
      repoUrl: repo_url,
      repoName: cloneName,
      repoSha: cloneSha,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "parse_failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }

  if (!parsed.files || parsed.files.length === 0) {
    return NextResponse.json({ error: "no_python" }, { status: 400 });
  }

  // Force repo metadata to use the canonical values
  parsed.repo = {
    url: repo_url,
    name: parsed.repo?.name || cloneName,
    sha: parsed.repo?.sha || cloneSha,
  };

  // 3. Cluster via Kimchi (best-effort: never fail the whole analyze on cluster error)
  let subsystems: Subsystem[] = [];
  try {
    const qnames = parsed.functions.map((f) => f.qname);
    subsystems = await clusterFunctions(qnames);
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
    // KimchiFormatError or anything else -> proceed with empty subsystems
    subsystems = [];
  }

  // 4. Push to Neo4j
  let counts;
  try {
    counts = await pushToNeo4j(parsed, subsystems);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (/auth/i.test(msg) || /unauthorized/i.test(msg)) {
      return NextResponse.json(
        { error: "neo4j_auth", hint: "check NEO4J credentials" },
        { status: 502 }
      );
    }
    if (/paused/i.test(msg) || /Connection refused/i.test(msg) || /timed out/i.test(msg)) {
      return NextResponse.json(
        { error: "neo4j_paused", hint: "resume instance" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "neo4j_write", message: msg },
      { status: 500 }
    );
  }

  // 5. Compose response
  const subsystemsOut = subsystems.map((s) => ({
    name: s.name,
    color: s.color,
    function_count: s.qnames.length,
    description: s.description,
  }));

  return NextResponse.json({
    repo: parsed.repo,
    counts,
    subsystems: subsystemsOut,
    truncated: !!parsed.truncated,
  });
}
