# Agents

Three sub-agents collaborate under the WAT framework. The orchestrator (top-level Claude) reads workflows and routes work to the right agent.

| Agent | File | Responsibility |
|---|---|---|
| Backend | [backend.md](backend.md) | Python tools, Neo4j writes, Kimchi calls, API routes |
| Frontend | [frontend.md](frontend.md) | Next.js pages, components, viz, chat UI |
| QA | [qa.md](qa.md) | Verification gate before any push or deploy |

## Interaction protocol

```
                  orchestrator
                  /     |     \
            backend  frontend  qa
              |         |        ^
              +---------+--------+
                        |
              .tmp/qa_queue.md (work-in)
                        |
                     qa-agent
                     /      \
                 approve    reject
                    |          |
                  push    qa_findings.md -> source
```

## Sub-agent spawning (agent-teams)

Backend and frontend agents may spawn their own sub-agents for genuinely
parallel work — e.g. backend splitting "parse_python" and "neo4j writer"
into two concurrent workers, or frontend splitting "viz" and "chat" into
parallel sub-builds. Rules:

1. Sub-agents must operate on **non-overlapping files** — sub-agent A
   cannot edit a file sub-agent B will also edit. Resolve conflicts at
   the parent level, not via merge.
2. Each sub-agent gets a self-contained brief: which file paths it owns,
   which it must NOT touch, what contract it produces.
3. Sub-agents post their completion to `.tmp/qa_queue.md` just like
   first-level agents.
4. The parent agent (backend/frontend) is responsible for verifying its
   sub-agents' output before signaling QA.

Reference: https://code.claude.com/docs/en/agent-teams

## Files used for handoff
- `.tmp/qa_queue.md` — backend/frontend → QA work queue
- `.tmp/qa_findings.md` — QA's verdicts and bug reports
- `.tmp/contract_requests.md` — frontend → backend API shape requests

## Skills wired into agents

Project-scope skills live under `.agents/skills/`. Each agent's markdown file lists the skills it should consult.

| Skill | Source | Primary consumer |
|---|---|---|
| `recon-schema` | local (`.tessl/skills/`) | backend (always — inlined into `/api/ask` prompt) |
| `frontend-design` | `anthropics/skills` | frontend |
| `vercel-react-native-skills` | `vercel-labs/agent-skills` | frontend (deploy ergonomics, despite the RN naming) |
| `brainstorming` | `obra/superpowers` | frontend (UI exploration), orchestrator (planning) |
| `find-skills` | `vercel-labs/skills` | QA, orchestrator |
| `skill-creator` | `anthropics/skills` | orchestrator, backend (revising recon-schema) |
| `github-actions-docs` | `xixu-me/skills` | QA, backend (CI mirror of qa_verify) |
| `vercel-plugin` (full pack: 26 skills, 6 cmds, 3 agents) | `vercel/vercel-plugin` | orchestrator (deploy/debug) |

Restart Claude Code (Ctrl+C twice → `claude`) for newly-installed skills to load.
