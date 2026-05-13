# Recon — 2-minute Demo Video

**Runtime: ~120s · 6 slides · ~20s each**
Distinct from [DEMO.md](DEMO.md), which is the live on-stage runbook. This file is for the recorded video judges watch async.

Script timed at ~150 wpm — read flat and confident, don't rush. Words per slide are kept honest below.

---

## Slide 1 — Title (0:00 – 0:15)

**Visual**
```
                  RECON
   Ask any Python repo a question.
        Get a real answer.

   Built in 2 hours · zero paid LLM credits
        Kimchi · Neo4j · Tessl
```
- Big logo / repo name top half
- Three sponsor logos along the bottom

**Voice-over (≈32 words / 13s)**
> This is Recon. Hand it a GitHub URL, get a structural map of the codebase and a chat box you can ask anything. The whole thing was built in two hours, on zero paid LLM credits.

---

## Slide 2 — The problem (0:15 – 0:35)

**Visual**
Split screen:
- **Left:** screenshot of a GitHub file tree with 400+ files. Caption: *"Where does auth live?"*
- **Right:** ChatGPT window saying *"I don't have access to that repository."* Caption: *"Useless."*

**Voice-over (≈40 words / 16s)**
> Joining any non-trivial Python codebase looks like this. Four hundred files, no map. Asking an LLM doesn't help — it can't see the repo, and even if it could, it hallucinates function names. You need a real query against a real structure.

---

## Slide 3 — Demo, part 1: paste → graph (0:35 – 1:00)

**Visual** — screen recording loop:
1. Paste `https://github.com/pallets/click` into Recon's input
2. ~3s analyze spinner
3. Graph viz fans out — nodes coloured by subsystem (parsing / decorators / completion / IO)
4. SummaryCard appears: *"178 files · 1,402 functions · 6 subsystems"*

**Voice-over (≈42 words / 17s)**
> Paste a repo. Recon clones it, parses every Python file's AST, and writes the structure into Neo4j — files, functions, who calls who, who imports who. Then Kimchi labels the clusters. What you see is a real graph, not a vibes diagram.

---

## Slide 4 — Demo, part 2: chat → answer (1:00 – 1:25)

**Visual** — recording continues:
1. User types in chat: *"What are the five most-called functions?"*
2. "Show query" disclosure expands to reveal generated Cypher:
   ```cypher
   MATCH (f:Function)<-[c:CALLS]-()
   WHERE EXISTS { (f)-[:DEFINED_IN]->(:File)-[:DEFINED_IN]->(:Repo {url:$repo_url}) }
   RETURN f.qname, count(c) AS n
   ORDER BY n DESC LIMIT 5
   ```
3. Five rows render below with counts
4. English summary appears: *"`Context.invoke` is the most-called function (43 callers), reflecting Click's command-dispatch design..."*

**Voice-over (≈45 words / 18s)**
> Now ask it anything. Kimchi turns the question into Cypher — grounded by a Tessl Skill that teaches it Recon's exact schema and modern Cypher 25 syntax. The query runs on Neo4j. Results come back as English. No hallucination, because the answer came from a real query.

---

## Slide 5 — The stack (1:25 – 1:50)

**Visual** — three columns, sponsor-coloured:

```
🌶️  KIMCHI            🔵  NEO4J             🟣  TESSL
the brain             the memory            the correctness
─────────────         ─────────────         ─────────────
Free Kimi K2.5        Aura free tier        3 Skills installed:
262k ctx window       graph DB              · neo4j-skills
                                              (Cypher 25)
Build time:           Build time:           · anthropics/skills
Claude Code runs      MCP server lets       · recon-schema
on Kimchi             agent query graph       (our schema)
                      directly
Runtime:              Runtime:              Effect:
labels subsystems     neo4j-driver          every generated
+ writes Cypher       writes + reads        Cypher is valid
                      the graph             Cypher 25
```

**Voice-over (≈45 words / 18s)**
> Every sponsor is load-bearing. Kimchi is the brain — same agent at build time and runtime, both free. Neo4j is the memory — a real graph, queryable by humans and agents. Tessl is the correctness layer — three Skills, including one we wrote, keep every Cypher query valid.

---

## Slide 6 — Close (1:50 – 2:00)

**Visual** — three lines, large type:
```
  Live at:  recon-silk.vercel.app
  Code:     github.com/veejay-kathuria/recon
  Stack:    Kimchi  +  Neo4j  +  Tessl

  "Claude Code running on Kimchi's free model,
   querying my Neo4j graph, with a Tessl skill
   keeping the queries correct."
```

**Voice-over (≈30 words / 12s)**
> Try it at recon-silk dot vercel dot app. Built in two hours, deployed on free tiers, every sponsor doing real work. Thanks to Kimchi, Neo4j, and Tessl.

---

## Timing cheat sheet

| Slide | Length | Cumulative |
|---|---|---|
| 1 Title | 15s | 0:15 |
| 2 Problem | 20s | 0:35 |
| 3 Demo: graph | 25s | 1:00 |
| 4 Demo: chat | 25s | 1:25 |
| 5 Stack | 25s | 1:50 |
| 6 Close | 10s | 2:00 |

## Production notes

- **Record Slides 3 & 4 first** using `pallets/click` (fastest popular repo to analyse). Re-run if the graph spread looks ugly — first cluster pass can be unbalanced.
- **Voice-over:** flat, no hype words ("revolutionary", "amazing"). The product is the demo; don't oversell.
- **Background music:** instrumental only, ducked to ~-18dB during voice-over.
- **Captions:** burn-in. Many judges watch muted on a phone.
- **Final mix-down:** 1920×1080, 30fps, MP4 H.264, target <50MB so it uploads anywhere.
- **The URL line in Slide 6 must match what's deployed** — currently `recon-silk.vercel.app` per [DEMO.md:55](DEMO.md#L55). Update both files if that changes.
