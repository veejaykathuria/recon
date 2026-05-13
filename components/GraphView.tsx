'use client';

import { useEffect, useRef, useState } from 'react';
import type { Subsystem } from './SummaryCard';

type Props = {
  subsystems: Subsystem[];
  functionsBySubsystem?: Record<string, string[]>;
  calls?: Array<{ from: string; to: string }>;
};

export default function GraphView({
  subsystems,
  functionsBySubsystem,
  calls,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let network: any = null;
    let cancelled = false;

    async function build() {
      if (!containerRef.current) return;
      if (!subsystems || subsystems.length === 0) return;

      try {
        // Dynamically import vis-network to avoid SSR issues
        const vis = await import('vis-network/standalone');
        if (cancelled || !containerRef.current) return;

        const nodes: any[] = [];
        const edges: any[] = [];

        for (const s of subsystems) {
          nodes.push({
            id: `sub:${s.name}`,
            label: `${s.name}\n(${s.function_count})`,
            color: { background: s.color, border: '#ffffff' },
            font: { color: '#ffffff', size: 16, face: 'sans-serif' },
            shape: 'dot',
            size: Math.max(20, Math.min(60, 14 + s.function_count)),
            title: s.description,
          });

          const fns = functionsBySubsystem?.[s.name] ?? [];
          for (const qname of fns.slice(0, 60)) {
            nodes.push({
              id: `fn:${qname}`,
              label: qname.split(':').pop() ?? qname,
              color: { background: s.color, border: s.color },
              font: { color: '#e6edf3', size: 11 },
              shape: 'dot',
              size: 6,
              title: qname,
            });
            edges.push({
              from: `sub:${s.name}`,
              to: `fn:${qname}`,
              color: { color: `${s.color}55`, opacity: 0.5 },
              dashes: true,
              smooth: false,
            });
          }
        }

        if (calls && calls.length > 0) {
          for (const c of calls.slice(0, 400)) {
            edges.push({
              from: `fn:${c.from}`,
              to: `fn:${c.to}`,
              arrows: 'to',
              color: { color: '#8b949e88' },
              smooth: { enabled: true, type: 'dynamic', roundness: 0.3 },
            });
          }
        }

        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        const options: any = {
          autoResize: true,
          physics: {
            stabilization: { iterations: 200 },
            barnesHut: { gravitationalConstant: -2200, springLength: 110 },
          },
          interaction: { hover: true, tooltipDelay: 150, dragNodes: true },
          nodes: { borderWidth: 1 },
          edges: { width: 1 },
        };

        network = new vis.Network(containerRef.current, data, options);
      } catch (err) {
        console.error('[GraphView] vis-network failed:', err);
        if (!cancelled) setFailed(true);
      }
    }

    build();

    return () => {
      cancelled = true;
      if (network) {
        try {
          network.destroy();
        } catch {}
      }
    };
  }, [subsystems, functionsBySubsystem, calls]);

  if (failed || !subsystems || subsystems.length === 0) {
    return (
      <div className="card">
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>
          {failed
            ? 'Graph renderer unavailable — showing list view.'
            : 'No subsystems to visualize yet.'}
        </div>
        <div className="subsystem-list">
          {subsystems.map((s) => (
            <div key={s.name} className="item">
              <span className="dot" style={{ background: s.color }} />
              <span className="name">{s.name}</span>
              <span style={{ color: '#8b949e', fontSize: 12 }}>
                · {s.function_count} fns
              </span>
              <span className="desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="graph-canvas" />;
}
