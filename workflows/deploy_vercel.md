# Workflow: deploy_vercel

## Objective
Ship the app to a public Vercel URL the judges can hit.

## Required inputs
- All env vars from `.env`
- A logged-in Vercel CLI (`vercel login` once)

## Steps
1. QA must have signed off (latest `.tmp/qa_findings.md` entry says PASS).
2. `vercel link` — bind the local folder to a project (first run only).
3. For each var in `.env`, run `vercel env add <NAME> production` and paste value.
4. `vercel deploy --prod` → capture the URL.
5. Hit `<url>/api/analyze` with `psf/requests` → confirm 200 and counts > 0.
6. Paste the URL into `PROJECT.md` under the verification checklist.

## Edge cases
- Build fails on Vercel but works locally → usually a missing dep in `package.json` or a node-only API used in an Edge route. Force Node runtime: `export const runtime = 'nodejs'` at top of route file.
- Kimchi or Neo4j env not set on Vercel → 500 with `error: kimchi_auth` or `neo4j_paused`. Re-add via `vercel env`.

## Status
- [ ] First production deploy
