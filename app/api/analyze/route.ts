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

function rid(): string {
  return Math.random().toString(36).slice(2, 8);
}

function logErr(reqId: string, stage: string, err: any): void {
  // Emit a single structured line per failure. Picked up by `vercel logs`.
  console.error(
    `[analyze][${reqId}][${stage}] ${err?.name || "Error"}: ${err?.message || String(err)}\n${(err?.stack || "").toString().split("\n").slice(0, 6).join("\n")}`
  );
}

export async function POST(req: NextRequest) {
  const reqId = rid();
  const t0 = Date.now();
  console.log(`[analyze][${reqId}] received`);

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    logErr(reqId, "body", err);
    return NextResponse.json({ error: "invalid_body", reqId }, { status: 400 });
  }
  const repo_url = (body?.repo_url || "").toString().trim();
  if (!repo_url || !/^https?:\/\//i.test(repo_url)) {
    return NextResponse.json({ error: "invalid_repo_url", reqId }, { status: 400 });
  }
  console.log(`[analyze][${reqId}] repo=${repo_url}`);

  // 1. Clone — isomorphic-git, no shell-out
  let clonePath: string;
  let cloneName: string;
  let cloneSha: string;
  try {
    const result = await cloneRepo(repo_url);
    clonePath = result.path;
    cloneName = result.name;
    cloneSha = result.sha;
  } catch (err: any) {
    logErr(reqId, "clone", err);
    return NextResponse.json(
      { error: "clone_failed", message: err?.message || String(err), reqId },
      { status: 500 }
    );
  }

  // 2. Parse — pure TS regex extractor
  let parsed: ParsedRepo;
  try {
    parsed = parsePythonRepo(clonePath, {
      repoUrl: repo_url,
      repoName: cloneName,
      repoSha: cloneSha,
    });
    console.log(`[analyze][${reqId}] parsed files=${parsed.files.length} fns=${parsed.functions.length} calls=${parsed.calls.length}`);
  } catch (err: any) {
    logErr(reqId, "parse", err);
    return NextResponse.json(
      { error: "parse_failed", message: err?.message || String(err), reqId },
      { status: 500 }
    );
  }

  if (!parsed.files || parsed.files.length === 0) {
    return NextResponse.json({ error: "no_python", reqId }, { status: 400 });
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
    const tc = Date.now();
    subsystems = await clusterFunctions(qnames);
    console.log(`[analyze][${reqId}] cluster subsystems=${subsystems.length} took=${Date.now() - tc}ms`);
  } catch (err: any) {
    logErr(reqId, "cluster", err);
    if (err instanceof KimchiAuthError) {
      return NextResponse.json(
        { error: "kimchi_auth", hint: "check KIMCHI_API_KEY", reqId },
        { status: 502 }
      );
    }
    if (err instanceof KimchiConfigError) {
      return NextResponse.json(
        { error: "kimchi_config", message: err.message, reqId },
        { status: 500 }
      );
    }
    // KimchiFormatError or anything else -> proceed with empty subsystems
    subsystems = [];
  }

  // 4. Push to Neo4j
  let counts;
  try {
    const tn = Date.now();
    counts = await pushToNeo4j(parsed, subsystems);
    console.log(`[analyze][${reqId}] neo4j_write took=${Date.now() - tn}ms`);
  } catch (err: any) {
    logErr(reqId, "neo4j_write", err);
    const msg = String(err?.message || err);
    if (/auth/i.test(msg) || /unauthorized/i.test(msg)) {
      return NextResponse.json(
        { error: "neo4j_auth", hint: "check NEO4J credentials", reqId },
        { status: 502 }
      );
    }
    if (/paused/i.test(msg) || /Connection refused/i.test(msg) || /timed out/i.test(msg)) {
      return NextResponse.json(
        { error: "neo4j_paused", hint: "resume instance", reqId },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "neo4j_write", message: msg, reqId },
      { status: 500 }
    );
  }

  const subsystemsOut = subsystems.map((s) => ({
    name: s.name,
    color: s.color,
    function_count: s.qnames.length,
    description: s.description,
  }));

  console.log(`[analyze][${reqId}] done total=${Date.now() - t0}ms`);
  return NextResponse.json({
    repo: parsed.repo,
    counts,
    subsystems: subsystemsOut,
    truncated: !!parsed.truncated,
  });
}
