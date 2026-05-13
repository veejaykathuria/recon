// Neo4j driver wrapper for Recon: writes the structural graph and exposes read helpers.

import neo4j, { Driver, Record as Neo4jRecord, Session } from "neo4j-driver";
import type { Subsystem } from "./cluster";

export interface ParsedRepo {
  repo: { url: string; name: string; sha: string };
  files: Array<{ path: string; language: string; loc: number }>;
  functions: Array<{
    qname: string;
    name: string;
    file_path: string;
    start_line: number;
    end_line: number;
    signature: string;
  }>;
  calls: Array<{ src_qname: string; dst_qname: string }>;
  imports: Array<{ src_path: string; dst_path: string }>;
  truncated: boolean;
}

export interface GraphCounts {
  files: number;
  functions: number;
  calls: number;
  subsystems: number;
}

let _driver: Driver | null = null;

function getDriver(): Driver {
  if (_driver) return _driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri) throw new Error("NEO4J_URI not set");
  if (!user) throw new Error("NEO4J_USERNAME not set");
  if (!password) throw new Error("NEO4J_PASSWORD not set");
  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    // Aura-friendly defaults
    maxConnectionLifetime: 60 * 60 * 1000,
    connectionAcquisitionTimeout: 30_000,
  });
  return _driver;
}

export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Wipe existing subgraph for repo_url and re-insert files, functions, calls, imports, subsystems.
 */
export async function pushToNeo4j(parsed: ParsedRepo, subsystems: Subsystem[]): Promise<GraphCounts> {
  const driver = getDriver();
  const session = driver.session();
  const repoUrl = parsed.repo.url;
  const analyzedAt = new Date().toISOString();

  try {
    // 1. Wipe existing repo subgraph.
    await session.run(
      `MATCH (r:Repo {url:$url})
       OPTIONAL MATCH (s:Subsystem)-[:PART_OF]->(r)
       OPTIONAL MATCH (f:File)-[:DEFINED_IN]->(r)
       OPTIONAL MATCH (fn:Function)-[:DEFINED_IN]->(f)
       DETACH DELETE fn, f, s, r`,
      { url: repoUrl }
    );

    // 2. Create Repo node
    await session.run(
      `CREATE (r:Repo {url:$url, name:$name, sha:$sha, analyzed_at:$analyzed_at})`,
      {
        url: repoUrl,
        name: parsed.repo.name,
        sha: parsed.repo.sha || "",
        analyzed_at: analyzedAt,
      }
    );

    // 3. Files
    for (const batch of chunk(parsed.files, 500)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (r:Repo {url:$url})
         CREATE (f:File {path:row.path, language:row.language, loc:row.loc})
         CREATE (f)-[:DEFINED_IN]->(r)`,
        { rows: batch, url: repoUrl }
      );
    }

    // 4. Functions
    for (const batch of chunk(parsed.functions, 500)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (r:Repo {url:$url})
         MATCH (file:File {path:row.file_path})-[:DEFINED_IN]->(r)
         CREATE (fn:Function {
           qname: row.qname,
           name: row.name,
           file_path: row.file_path,
           start_line: row.start_line,
           end_line: row.end_line,
           signature: row.signature
         })
         CREATE (fn)-[:DEFINED_IN]->(file)`,
        { rows: batch, url: repoUrl }
      );
    }

    // 5. Calls
    for (const batch of chunk(parsed.calls, 1000)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (r:Repo {url:$url})
         MATCH (src:Function {qname:row.src_qname})-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r)
         MATCH (dst:Function {qname:row.dst_qname})-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r)
         CREATE (src)-[:CALLS]->(dst)`,
        { rows: batch, url: repoUrl }
      );
    }

    // 6. Imports
    for (const batch of chunk(parsed.imports, 1000)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (r:Repo {url:$url})
         MATCH (src:File {path:row.src_path})-[:DEFINED_IN]->(r)
         MATCH (dst:File {path:row.dst_path})-[:DEFINED_IN]->(r)
         CREATE (src)-[:IMPORTS]->(dst)`,
        { rows: batch, url: repoUrl }
      );
    }

    // 7. Subsystems + BELONGS_TO
    if (subsystems && subsystems.length > 0) {
      const subRows = subsystems.map((s) => ({
        name: s.name,
        description: s.description || "",
        color: s.color || "#9ca3af",
      }));
      await session.run(
        `UNWIND $rows AS row
         MATCH (r:Repo {url:$url})
         CREATE (s:Subsystem {name:row.name, description:row.description, color:row.color})
         CREATE (s)-[:PART_OF]->(r)`,
        { rows: subRows, url: repoUrl }
      );

      const belongsRows: Array<{ subsystem: string; qname: string }> = [];
      for (const s of subsystems) {
        for (const q of s.qnames) {
          belongsRows.push({ subsystem: s.name, qname: q });
        }
      }
      for (const batch of chunk(belongsRows, 1000)) {
        await session.run(
          `UNWIND $rows AS row
           MATCH (r:Repo {url:$url})
           MATCH (s:Subsystem {name:row.subsystem})-[:PART_OF]->(r)
           MATCH (fn:Function {qname:row.qname})-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r)
           CREATE (fn)-[:BELONGS_TO]->(s)`,
          { rows: batch, url: repoUrl }
        );
      }
    }

    return await getCountsInternal(session, repoUrl);
  } finally {
    await session.close();
  }
}

async function getCountsInternal(session: Session, repoUrl: string): Promise<GraphCounts> {
  const res = await session.run(
    `MATCH (r:Repo {url:$url})
     OPTIONAL MATCH (f:File)-[:DEFINED_IN]->(r)
     WITH r, count(DISTINCT f) AS files
     OPTIONAL MATCH (fn:Function)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r)
     WITH r, files, count(DISTINCT fn) AS functions
     OPTIONAL MATCH (a:Function)-[c:CALLS]->(b:Function)
     WHERE EXISTS { (a)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r) }
       AND EXISTS { (b)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(r) }
     WITH r, files, functions, count(c) AS calls
     OPTIONAL MATCH (s:Subsystem)-[:PART_OF]->(r)
     RETURN files, functions, calls, count(DISTINCT s) AS subsystems`,
    { url: repoUrl }
  );
  const rec = res.records[0];
  if (!rec) return { files: 0, functions: 0, calls: 0, subsystems: 0 };
  return {
    files: toNum(rec.get("files")),
    functions: toNum(rec.get("functions")),
    calls: toNum(rec.get("calls")),
    subsystems: toNum(rec.get("subsystems")),
  };
}

export async function getCounts(repoUrl: string): Promise<GraphCounts> {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    return await getCountsInternal(session, repoUrl);
  } finally {
    await session.close();
  }
}

/**
 * Run a read-only Cypher query and return plain JS rows.
 */
export async function runReadOnly(
  cypher: string,
  params: Record<string, any> = {}
): Promise<Array<Record<string, any>>> {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    const res = await session.run(cypher, params);
    return res.records.map(recordToPlain);
  } finally {
    await session.close();
  }
}

function recordToPlain(rec: Neo4jRecord): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of rec.keys as string[]) {
    out[key] = neoToPlain(rec.get(key));
  }
  return out;
}

function neoToPlain(value: any): any {
  if (value === null || value === undefined) return value;
  if (neo4j.isInt(value)) {
    return (value as any).toNumber ? (value as any).toNumber() : Number(value);
  }
  if (Array.isArray(value)) return value.map(neoToPlain);
  if (typeof value === "object") {
    // Node
    if ("labels" in value && "properties" in value) {
      return {
        _type: "node",
        labels: (value as any).labels,
        properties: neoToPlain((value as any).properties),
      };
    }
    // Relationship
    if ("type" in value && "start" in value && "end" in value && "properties" in value) {
      return {
        _type: "relationship",
        type: (value as any).type,
        properties: neoToPlain((value as any).properties),
      };
    }
    // Path
    if ("segments" in value && Array.isArray((value as any).segments)) {
      return {
        _type: "path",
        segments: (value as any).segments.map((seg: any) => ({
          start: neoToPlain(seg.start),
          relationship: neoToPlain(seg.relationship),
          end: neoToPlain(seg.end),
        })),
      };
    }
    // Plain object (e.g. properties map)
    const obj: Record<string, any> = {};
    for (const k of Object.keys(value)) obj[k] = neoToPlain((value as any)[k]);
    return obj;
  }
  return value;
}

function toNum(v: any): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return Number(v) || 0;
}
