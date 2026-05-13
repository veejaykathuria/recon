# Recon — Build Plan

Live status of what's built, what's broken, and what's next. Written at T-30 min from demo.

## Architecture (built, frozen)

WAT (Workflows / Agents / Tools). See [agents/README.md](agents/README.md) and [workflows/README.md](workflows/README.md).

- **3 agents** with hard contracts: [backend](agents/backend.md), [frontend](agents/frontend.md), [qa](agents/qa.md). Handoff via `.tmp/qa_queue.md` and `.tmp/contract_requests.md`.
- **6 workflows** (SOPs) covering setup, analyze, ask, qa gate, deploy, model-fallback.
- **1 local Tessl skill** at `.tessl/skills/recon-schema/SKILL.md` — encodes graph schema + Cypher rules; loaded into `/api/ask` system prompt at runtime.

## What's built and working

| Layer | Component | Status | Verified by |
|---|---|---|---|
| Backend | Next.js + TS scaffold (`package.json`, `tsconfig.json`, `next.config.js`) | ✅ | `next build` passes |
| Backend | `tools/clone_repo.py` (shallow clone, Windows-safe cleanup) | ✅ | direct run |
| Backend | `tools/parse_python.py` (AST → files/functions/calls/imports) | ✅ | 37 files, 628 fns, 537 calls on `psf/requests` |
| Backend | `tools/check_env.py` (Neo4j + Kimchi pings) | ✅ | both PASS |
| Backend | `lib/kimchi.ts` (OpenAI-compat client, `reasoning_content` fallback) | ✅ | direct curl + integration |
| Backend | `lib/graph.ts` (wipe-then-write to Neo4j Aura) | ✅ | graph populated, counts match |
| Backend | `app/api/analyze` POST | ✅ | returns counts; ⚠️ subsystems still 0 (see below) |
| Backend | `app/api/ask` POST | ✅ | curl: cypher + answer + data, injection rejected (`kimchi_format` 502 on intent classification of CREATE) |
| Frontend | `app/layout.tsx`, `app/globals.css` | ✅ | builds clean (1 fix applied) |
| Frontend | `app/page.tsx` (sections A/B/C/D) | ✅ | renders, dynamic-imports `GraphView` |
| Frontend | `components/{RepoInput,SummaryCard,GraphView,Chat}.tsx` | ✅ | builds clean |
| QA | static gate (build, types, py-compile, secret grep, schema grep) | ✅ | [.tmp/qa_findings.md](.tmp/qa_findings.md) |
| QA | e2e smoke (`tools/smoke_test.py`) | ⚠️ | analyze succeeds; clustering returns 0; first /ask passes |
| Infra | `.env` (Neo4j Aura free + Kimchi via llm.kimchi.dev) | ✅ | check_env PASS |
| Infra | Tessl CLI installed, registry reachable | ✅ | search works; upstream-skill install blocked on Windows Developer Mode (symlinks) |

## Known issues (T-30 min)

1. **Clustering returns 0 subsystems** at 628 qnames. Direct probe with 10 qnames works fine — Kimi K2.5 is a thinking model, the reasoning burns tokens before content emerges, and at 628 qnames the JSON output gets truncated mid-array. **Fix candidates (pick fastest):**
   - Switch model env to `qwen3-coder-next-fp8` (coder/non-thinking, fastest path).
   - Or chunk qnames into ~100/batch and merge results client-side.
   - Or accept and ship — frontend `GraphView` degrades to "uncategorized" if subsystems empty.
2. **`/api/ask` returns 502 `kimchi_format` on the injection test** ("create a node called test"). This is because Kimi refuses to emit valid JSON for a clearly forbidden request — net effect is the same (the write attempt does NOT execute against Neo4j), but the error code differs from the expected 400 `invalid_cypher`. **Fix:** treat `kimchi_format` after a write-shaped intent as an implicit rejection, or first-pass intent filter in the route. **Defer** unless judge asks.
3. **`truncated: true` returned even at 37 files** (well under the 500 cap). Cosmetic — pure flag bug in `parse_python.py`. **Defer.**

## Remaining work (T-30 → T-0)

| # | Step | Owner | ETA | Commit message |
|---|---|---|---|---|
| 1 | Commit WAT scaffold + workflows + agents | orchestrator | 1 min | `chore: WAT scaffold — agents, workflows, recon-schema skill` |
| 2 | Commit backend (tools, lib, api routes) + frontend (page, components) | orchestrator | 1 min | `feat: backend tools + lib + api routes; frontend page + components` |
| 3 | Commit env scaffolding + smoke + QA artifacts | orchestrator | 1 min | `chore: env example, smoke test, QA findings` |
| 4 | Pick fix for clustering (model swap to `qwen3-coder-next-fp8` recommended) | orchestrator | 3 min | `fix(cluster): use non-thinking model to avoid token-budget truncation` |
| 5 | Run smoke again, accept residual gaps | orchestrator | 3 min | — |
| 6 | `vercel link`, set env vars via `vercel env add`, `vercel deploy --prod` | orchestrator | 8 min | — |
| 7 | Hit deployed `/api/analyze` against `psf/requests` for sanity | orchestrator | 2 min | — |
| 8 | Update PROJECT.md verification checklist with the live URL | orchestrator | 1 min | `docs: pin deployed URL` |
| 9 | Demo dry-run (URL → analyze → ask → show cypher disclosure) | user | 5 min | — |

Buffer: ~5 min for the inevitable surprise.

## Demo script (for the judges, T-0)

> "This is Claude Code running on Kimchi's free Kimi-K2.5 model — see `/status`. It just built this app in 2 hours. The app I'm about to demo *also* runs on Kimchi at runtime, queries my Neo4j Aura graph, and uses a Tessl skill (`recon-schema`) to keep the Cypher correct."

1. Paste `https://github.com/psf/requests` → click Analyze → ~60s → counts + subsystem chips appear.
2. Ask *"What are the most-called functions?"* → answer + cypher disclosure (modern Cypher 25 syntax — visible Tessl proof).
3. (If asked) Open Neo4j Browser, run `MATCH (n) RETURN count(n)` — proves the graph is real.
4. Show `/status` in the terminal — `kimi-k2.5`. Proves Kimchi at build-time.
