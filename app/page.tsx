'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import RepoInput from '../components/RepoInput';
import SummaryCard, { AnalyzeResult } from '../components/SummaryCard';
import Chat from '../components/Chat';
import DataflowAscii from '../components/DataflowAscii';
import { apiUrl } from '../lib/api-base';

// vis-network touches window/document — load client-only.
const GraphView = dynamic(() => import('../components/GraphView'), {
  ssr: false,
  loading: () => (
    <div className="graph-canvas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Loading graph…
    </div>
  ),
});

type ApiError = { error: string; hint?: string; message?: string };

export default function Page() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const onAnalyze = async (repoUrl: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError({
          error: json.error ?? `Request failed (${res.status})`,
          hint: json.hint,
          message: json.message,
        });
        setResult(null);
      } else {
        setResult(json as AnalyzeResult);
      }
    } catch (err: any) {
      setError({ error: 'network_error', hint: err?.message ?? String(err) });
      setResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="container">
      <header className="header">
        <h1>Recon</h1>
        <span className="tagline">
          Claude Code on Kimchi → Neo4j graph → Tessl-grounded Cypher
        </span>
      </header>

      <section className="section">
        <h2>1. Pick a repo</h2>
        <RepoInput onAnalyze={onAnalyze} loading={analyzing} />
        {error && (
          <div className="error-box">
            {error.error}
            {(error.hint || error.message) && (
              <div className="hint">{error.hint ?? error.message}</div>
            )}
          </div>
        )}
      </section>

      {result && (
        <>
          <section className="section">
            <h2>2. Summary</h2>
            <SummaryCard result={result} />
          </section>

          <section className="section">
            <h2>3. Subsystem graph</h2>
            <GraphView subsystems={result.subsystems} />
          </section>

          <section className="section">
            <h2>4. Dataflow (ASCII)</h2>
            <DataflowAscii ascii={result.dataflow_ascii ?? ''} />
          </section>

          <section className="section">
            <h2>5. Ask the graph</h2>
            <Chat repoUrl={result.repo.url} />
          </section>
        </>
      )}

      {!result && (
        <section className="section">
          <h2>5. Ask the graph</h2>
          <Chat />
        </section>
      )}

      <footer className="explainer">
        <h2>What is Recon?</h2>
        <p>
          Recon turns any Python repo on GitHub into an interactive,
          query-able graph of its own structure. Paste a URL, hit
          <strong> Analyze</strong>, and within seconds you get:
        </p>
        <ul>
          <li>
            <strong>A graph in Neo4j</strong> — every file, function,
            <code>CALLS</code> edge and <code>IMPORTS</code> edge from
            the repo, stored in your Aura instance.
          </li>
          <li>
            <strong>Subsystem clusters</strong> — Kimchi groups the
            functions into 3-8 labelled subsystems (auth, sessions,
            adapters, ...). Each color in the graph is one cluster.
          </li>
          <li>
            <strong>ASCII dataflow</strong> — a copy-paste-friendly
            view of the same clusters and the weighted
            cross-subsystem calls between them.
          </li>
          <li>
            <strong>Natural-language chat</strong> — ask
            <em> &quot;what are the most-called functions?&quot;</em> and the
            answer comes from a real Cypher query, not a guess. Click
            <em> Show query</em> on any answer to see the underlying
            Cypher.
          </li>
        </ul>

        <h3>How it works</h3>
        <p>
          The page calls <code>POST /api/analyze</code>. That route
          downloads the repo&apos;s tarball, walks every <code>.py</code>{' '}
          file with a regex-based AST extractor, asks{' '}
          <strong>Kimchi</strong> (the free Kimi-K2.5 / nemotron model
          gateway from Cast AI) to label the subsystems, then writes the
          whole graph into <strong>Neo4j Aura</strong>. The chat box
          posts to <code>/api/ask</code>; the system prompt is the
          <code> recon-schema</code> <strong>Tessl Skill</strong>{' '}
          (under <code>.tessl/skills/</code>) so the generated Cypher
          uses modern Cypher 25 syntax and stays read-only. The whole
          thing was built in 2 hours under the
          <strong> WAT framework</strong> (Workflows, Agents, Tools){' '}
          — see <code>agents/</code> and <code>workflows/</code> for
          how a backend, frontend and QA sub-agent coordinated the
          build.
        </p>

        <h3>What this is not</h3>
        <p>
          Not a linter, not a refactoring tool, not a static type
          checker. The graph is shallow — function definitions and
          best-effort call resolution by name — but it is a{' '}
          <em>real</em> graph you can query, not a screenshot.
        </p>
      </footer>
    </main>
  );
}
