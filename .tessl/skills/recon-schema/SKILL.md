---
name: recon-schema
description: When writing Cypher queries for the Recon code-analysis app, follow this schema and these rules. Used both at build time (orchestrator drafts Cypher) and runtime (Kimchi generates Cypher in /api/ask).
---

# Recon graph schema

## Nodes
- `(:Repo {url, name, sha, analyzed_at})`
- `(:File {path, language, loc})`
- `(:Function {qname, name, file_path, start_line, end_line, signature})`
- `(:Subsystem {name, description, color})`

## Edges
- `(:File)-[:DEFINED_IN]->(:Repo)`
- `(:Function)-[:DEFINED_IN]->(:File)`
- `(:Function)-[:CALLS]->(:Function)`
- `(:File)-[:IMPORTS]->(:File)`
- `(:Function)-[:BELONGS_TO]->(:Subsystem)`
- `(:Subsystem)-[:PART_OF]->(:Repo)`

## Identifiers
- `Repo.url` is the unique key. Scope every query to a `:Repo {url:$repo_url}`.
- `Function.qname` is the unique key (`module.path:fn_name`).
- `File.path` is unique within a repo, not across repos.

## Cypher rules
1. **Read-only.** Never `CREATE`, `DELETE`, `MERGE`, `SET`, `REMOVE`, or `DROP`.
2. **Always `LIMIT`.** Cap at 50 rows unless explicitly aggregating.
3. **Modern syntax (Cypher 25).** Prefer `MATCH path = SHORTEST k (a)-[*]-(b)` over deprecated `shortestPath()`. Prefer `EXISTS { ... }` subqueries over `WHERE EXISTS()` predicates.
4. **Scope to repo.** Every query takes `$repo_url` and filters via `Repo {url:$repo_url}`.
5. **Aliases.** Always alias counts, sums, collects: `RETURN count(c) AS calls`.

## Few-shot examples

**Most-called functions:**
```cypher
MATCH (callee:Function)<-[c:CALLS]-(:Function)
WHERE EXISTS { (callee)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(:Repo {url:$repo_url}) }
RETURN callee.qname AS qname, count(c) AS calls
ORDER BY calls DESC
LIMIT 10
```

**Subsystem overview:**
```cypher
MATCH (s:Subsystem)-[:PART_OF]->(:Repo {url:$repo_url})
OPTIONAL MATCH (f:Function)-[:BELONGS_TO]->(s)
RETURN s.name AS name, s.color AS color, count(f) AS function_count
ORDER BY function_count DESC
LIMIT 50
```

**Shortest call path between two functions:**
```cypher
MATCH (a:Function {qname:$from}), (b:Function {qname:$to})
MATCH path = SHORTEST 1 (a)-[:CALLS*]->(b)
RETURN path
LIMIT 1
```

**Files that import the most others:**
```cypher
MATCH (f:File)-[i:IMPORTS]->(:File)
WHERE EXISTS { (f)-[:DEFINED_IN]->(:Repo {url:$repo_url}) }
RETURN f.path AS path, count(i) AS imports
ORDER BY imports DESC
LIMIT 10
```
