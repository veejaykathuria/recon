# Demo runbook

**Path:** localhost-only. Most reliable, lowest latency, all paths proven working.

## Pre-flight (5 min before you walk to the stage)

```powershell
cd c:\Users\veeja\Desktop\Hackathon\recon

# 1. Make sure the server is up
curl -s -o NUL -w "%{http_code}`n" http://localhost:3000
# Expect: 200. If not: npm run start

# 2. Smoke /api/ask against the already-loaded graph
curl -s -X POST -H "Content-Type: application/json" `
  -d '{\"question\":\"What are the most-called functions?\",\"repo_url\":\"https://github.com/psf/requests\"}' `
  http://localhost:3000/api/ask | python -c "import sys,json; r=json.load(sys.stdin); print(r['answer'][:200])"
# Expect: one sentence about most-called functions.

# 3. Open browser tabs
start http://localhost:3000
start https://console.neo4j.io           # have Neo4j Browser ready as a proof point
```

## On stage (5-min demo)

**Opening line (per the Combined Project Ideas PDF tip 3):**
> "This is Claude Code running on Kimchi's free Kimi-K2.5 model. It built this entire app in 2 hours. The app you're about to see also runs on Kimchi at runtime, queries my Neo4j Aura graph, and uses a Tessl skill to keep the Cypher correct."

**Step 1 — show Kimchi at build-time.** Open the terminal, type `/status`. Audience sees `kimi-k2.5`.

**Step 2 — paste a repo.** In the browser at `localhost:3000`, click the `psf/requests` chip. Click **Analyze**. While it runs (~60s), say:
> "It's cloning the repo, parsing every Python file's AST, asking Kimchi to cluster the functions into subsystems, and writing the graph into Neo4j Aura."

**Step 3 — the result.** Counts card appears (37 files / 628 fns / 537 calls). Subsystem chips appear (auth, cookies, adapters, api, ...). Graph viz renders. Say:
> "Eight subsystems. Each color is one Kimchi-classified cluster of functions. That's a real graph in Neo4j, not a static image."

**Step 4 — ask the graph.** In the chat box, type:
> "What are the most-called functions?"

Show the English answer. Click **"Show query"** disclosure. Say:
> "That's modern Cypher 25 syntax — `EXISTS {...}` subquery, scoped to `$repo_url`. That syntax comes from the Tessl skill at `.tessl/skills/recon-schema/SKILL.md`, which the Kimchi prompt loads at runtime."

**Step 5 (optional Neo4j proof).** Switch to the Neo4j Browser tab. Run:
```cypher
MATCH (n) RETURN count(n)
```
> "Real nodes. Real graph. The agent answers by querying this, not by hallucinating."

**Step 6 — close.** Say:
> "Three sponsors, one stack. Kimchi gave us a free LLM for the build AND the runtime. Neo4j gave the agent real memory through a real query. Tessl kept the Cypher correct. The architecture is at `agents/` — three sub-agents (backend / frontend / QA) coordinated through markdown contracts."

## Public URL (backup, optional)

If a judge asks "can I try it myself?": https://recon-silk.vercel.app

This is the Vercel deploy of commit `6792cbe` — same Neo4j, same Kimchi, AST parser swapped from `ast.parse` to a regex extractor because Vercel functions have no Python or git. Caveat: cluster step is right at Vercel Hobby's 60s function limit; works for small/medium repos. Disable deployment protection in dashboard before sharing.

## If something dies mid-demo

| Symptom | Fix |
|---|---|
| Browser shows network error | `npm run start` again; refresh page |
| Analyze hangs >2 min | Probably Kimchi or Neo4j paused. Resume Aura at console.neo4j.io; restart server |
| Chat 502 `kimchi_format` | Kimi K2.5 had a bad reasoning loop; ask the question again |
| `/status` shows `claude-sonnet-*` not `kimi-k2.5` | You hit Kimchi's 90% quota and auto-fell back to Sonnet (per `workflows/fallback_to_sonnet.md`). Honest: tell the judges, the build was still on Kimchi until the switch. Runtime is unaffected. |

## What "verify each sponsor" looks like

| Sponsor | One-liner proof |
|---|---|
| Kimchi (build) | terminal `/status` → `kimi-k2.5` |
| Kimchi (runtime) | open `app/api/ask/route.ts` — `chat()` calls `lib/kimchi.ts`, base URL is `llm.kimchi.dev` |
| Neo4j (build) | `~/.claude/settings.json` → `mcpServers.neo4j` (or omit if not configured) |
| Neo4j (runtime) | Neo4j Browser → `MATCH (n) RETURN count(n)` is non-zero |
| Tessl | the "Show query" disclosure in the chat. `.tessl/skills/recon-schema/SKILL.md` is the skill content inlined into Kimchi's system prompt. |
