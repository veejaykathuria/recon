# Recon

Graph-based code analysis on Kimchi + Neo4j + Tessl. See [PROJECT.md](PROJECT.md) for the sponsor-integration breakdown and [agents/](agents/) for the WAT agent roster.

## Quickstart

```bash
cp .env.example .env       # fill in NEO4J_* and KIMCHI_*
npm install
python tools/check_env.py  # verify Neo4j + Kimchi reachable
npm run dev                # http://localhost:3000
```

## WAT layout

```
agents/       # backend / frontend / qa personas
workflows/    # SOPs the orchestrator follows
tools/        # Python scripts (clone, parse, env check, smoke)
lib/          # TypeScript libs reused by API routes
app/api/      # Next.js API routes (/analyze, /ask)
app/          # Next.js pages
.tessl/       # local Tessl skill (recon-schema)
.tmp/         # disposable handoff + processing files
```

## Demo flow
1. Paste a Python repo URL (or click `psf/requests`).
2. Click Analyze → ~60s → graph + subsystem chips appear.
3. Ask "what are the most-called functions?" → see Cypher disclosure + answer.
