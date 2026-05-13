'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import RepoInput from '../components/RepoInput';
import SummaryCard, { AnalyzeResult } from '../components/SummaryCard';
import Chat from '../components/Chat';

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
      const res = await fetch('/api/analyze', {
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
            <h2>4. Ask the graph</h2>
            <Chat repoUrl={result.repo.url} />
          </section>
        </>
      )}

      {!result && (
        <section className="section">
          <h2>4. Ask the graph</h2>
          <Chat />
        </section>
      )}
    </main>
  );
}
