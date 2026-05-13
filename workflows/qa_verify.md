# Workflow: qa_verify

## Objective
Block any push or deploy unless the system passes the verification suite.

## When invoked
- Before `git push`
- Before `vercel deploy`
- When backend or frontend enters work in `.tmp/qa_queue.md`

## Steps
1. **Static checks**
   - `npm run build` exits 0
   - `python -m py_compile tools/*.py` exits 0
2. **Contract checks** — diff API route responses against `agents/backend.md` JSON shapes.
3. **Schema checks** — grep the diff for any new node labels / edge types not in `PROJECT.md`. Any new ones → fail.
4. **Smoke test (one of):**
   - `curl -X POST localhost:3000/api/analyze -d '{"repo_url":"https://github.com/psf/requests"}'` → expect `counts.functions > 100`
   - Then `curl -X POST localhost:3000/api/ask -d '{"question":"most called functions","repo_url":"https://github.com/psf/requests"}'` → expect non-empty `cypher` and `data`.
5. **Secret hygiene** — `grep -rE "KIMCHI_API_KEY|NEO4J_PASSWORD" app lib tools components` returns no hardcoded strings (env reads OK).
6. **Demo states** — page renders empty / analyzed / chatting without console errors (manual eyeball).

## Output (`.tmp/qa_findings.md`)
```
## Review YYYY-MM-DD HH:MM
- Trigger: <what was being reviewed>
- Result: PASS | FAIL | DEFER
- Findings:
  - [pass] build
  - [fail] /api/ask returns 500 — Kimchi key not loaded
- Next action: <whose ball>
```

## Status
- [ ] First gate run
