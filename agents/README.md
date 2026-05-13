# Agents

Three sub-agents collaborate under the WAT framework. The orchestrator (top-level Claude) reads workflows and routes work to the right agent.

| Agent | File | Responsibility |
|---|---|---|
| Backend | [backend.md](backend.md) | Python tools, Neo4j writes, Kimchi calls, API routes |
| Frontend | [frontend.md](frontend.md) | Next.js pages, components, viz, chat UI |
| QA | [qa.md](qa.md) | Verification gate before any push or deploy |

## Interaction protocol

```
       ┌─── backend ─┐         ┌─── frontend ─┐
orchestrator        │ contracts │
       │            ▼           ▼
       │      .tmp/qa_queue.md (work in)
       │            │
       ▼            ▼
        ───── QA agent ─────
                 │
        approve ─┴─ reject
            │         │
          push     .tmp/qa_findings.md → back to source agent
```

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
