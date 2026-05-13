# Workflow: setup_env

## Objective
Get the local dev environment ready in under 5 minutes: install deps, write `.env`, verify Neo4j + Kimchi reachability.

## Required inputs
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` (from console.neo4j.io)
- `KIMCHI_BASE_URL`, `KIMCHI_API_KEY`, `KIMCHI_MODEL` (from cast.ai)
- Optional: `GITHUB_TOKEN` for higher API rate limits

## Steps
1. Create `.env` from `.env.example` and paste values.
2. `npm install` (root) and `pip install -r tools/requirements.txt`.
3. Run `python tools/check_env.py` — pings Neo4j + Kimchi, prints PASS/FAIL per service.
4. Commit `.env.example` only; verify `.env` is in `.gitignore`.

## Outputs
- Working `.env`
- Green output from `check_env.py`

## Failure modes & fixes
- Neo4j auth fails → instance may be paused, resume in Aura console.
- Kimchi 401 → key has expired or wrong base URL; re-fetch from sponsor table.
- `mcp-neo4j-cypher` not callable from Claude Code → run `uvx mcp-neo4j-cypher@latest --help` to prime the cache.

## Status
- [ ] First run completed
