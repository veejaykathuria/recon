# Workflow: analyze_repo

## Objective
Given a GitHub Python repo URL, populate the Neo4j graph with files, functions, calls, imports, and subsystem labels — within ~60–90s for a small repo.

## Required inputs
- `repo_url` (HTTPS GitHub URL, Python repo)

## Tools used (in order)
1. `tools/clone_repo.py` — shallow clone into `.tmp/<repo-name>/`. Depth 1.
2. `tools/parse_python.py` — walks the tree, runs `ast.parse` on every `.py` (capped at 500 files / 5000 fns), extracts:
   - File: path, language, loc
   - Function: qname (`module.path:name`), name, file_path, start_line, end_line, signature
   - Edges: CALLS (function→function by qname, resolved best-effort), IMPORTS (file→file)
3. `lib/cluster.ts` — sends function qnames to Kimchi in a single batched call → returns subsystem label per qname + color hex + short description.
4. `lib/graph.ts:pushToNeo4j()` — wipes prior subgraph for this repo URL, then writes nodes & edges in batched `UNWIND` queries.

## Output contract (HTTP response from `/api/analyze`)
```json
{
  "repo": { "url": "...", "name": "...", "sha": "..." },
  "counts": { "files": 0, "functions": 0, "calls": 0, "subsystems": 0 },
  "subsystems": [ { "name": "...", "color": "#hex", "function_count": 0, "description": "..." } ],
  "truncated": false
}
```

## Edge cases
- Repo > 500 Python files → parse first 500, set `truncated: true`.
- Repo has no `.py` files → return 400 with `{ error: "no_python" }`.
- Kimchi clustering fails → still write the graph; subsystems list empty; UI shows "uncategorized" placeholder.
- Neo4j write fails → return 500 with `{ error: "neo4j_write", message: ... }`.

## Verification (QA owns)
Run against `https://github.com/psf/requests` and confirm:
- Counts: ~30 files, several hundred functions, non-zero calls
- Subsystems list has 3–8 entries
- Cypher run via Neo4j Browser: `MATCH (s:Subsystem)-[:PART_OF]->(:Repo {url:$url}) RETURN s` returns the same names.

## Status
- [ ] First green run
