# Workflow: ask_question

## Objective
Translate a natural-language question into a read-only Cypher query, run it, and return an English answer plus structured data the frontend can render.

## Required inputs
- `question` (string)
- `repo_url` (string, to scope the query) — optional; if absent, applies across all repos

## Steps (in `app/api/ask/route.ts`)
1. **Compose Kimchi prompt #1.** System prompt = contents of `.tessl/skills/recon-schema/SKILL.md` + few-shot examples. User content = the question.
2. **Call Kimchi** → expect JSON: `{ cypher, view }` where `view ∈ {"graph","list","chart"}`.
3. **Validate Cypher.**
   - Must start with `MATCH` or `WITH`
   - Must not contain CREATE / DELETE / MERGE / SET / REMOVE / DROP
   - Must contain `LIMIT` (auto-append `LIMIT 50` if missing)
   - On failure, return 400 with `{ error: "invalid_cypher", cypher }`
4. **Run via neo4j-driver** with the scoped `$repo_url` param.
5. **Compose Kimchi prompt #2.** Feed back results → return short English answer.
6. **Respond** with full payload below.

## Output contract
```json
{
  "cypher": "MATCH ... RETURN ...",
  "view": "graph",
  "answer": "Plain-English answer.",
  "data": [ /* raw rows from Neo4j */ ]
}
```

## Edge cases
- Kimchi returns non-JSON → retry once with stricter prompt; on second fail return `{ error: "kimchi_format" }`.
- Query times out (>10s) → return `{ error: "timeout", cypher }`.
- Empty result set → `answer` should say so plainly ("No matching functions found in this repo.").

## Few-shot examples (inline in system prompt)
1. "What are the most-called functions?" → `MATCH (f:Function)<-[c:CALLS]-(:Function) WHERE EXISTS { (f)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(:Repo {url:$repo_url}) } RETURN f.qname, count(c) AS calls ORDER BY calls DESC LIMIT 10` (view: chart)
2. "Show me the auth subsystem." → `MATCH (s:Subsystem {name:'auth'})<-[:BELONGS_TO]-(f:Function) RETURN f LIMIT 50` (view: graph)
3. "Which file imports the most others?" → `MATCH (f:File)-[i:IMPORTS]->(:File) RETURN f.path, count(i) AS imports ORDER BY imports DESC LIMIT 10` (view: chart)

## Verification (QA owns)
- Ask each of the three examples; verify Cypher in response matches schema; verify English answer references the data.
- Try a CREATE attempt ("create a node called test") — must return `invalid_cypher`.

## Status
- [ ] First green run
