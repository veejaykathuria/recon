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
