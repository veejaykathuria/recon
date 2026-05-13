'use client';

import { useState } from 'react';

type Props = {
  ascii: string;
  narrative?: string;
};

export default function DataflowAscii({ ascii, narrative }: Props) {
  const [copied, setCopied] = useState(false);

  if (!ascii) {
    return (
      <div style={{ color: '#8b949e', fontSize: 12 }}>
        No dataflow computed (no cross-subsystem calls or analyze step skipped).
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        narrative ? `${narrative}\n\n${ascii}` : ascii
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          Subsystem boxes + top cross-subsystem call edges, plus a Kimchi-written
          narrative interpreting how data flows. Copy-paste into a README.
        </span>
        <button onClick={copy} style={{ minWidth: 80 }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {narrative && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.55,
            color: '#c9d1d9',
            whiteSpace: 'pre-wrap',
          }}
        >
          <span
            className="badge"
            style={{
              marginLeft: 0,
              marginRight: 8,
              background: '#1f6feb',
              color: '#fff',
            }}
          >
            Kimchi
          </span>
          {narrative}
        </div>
      )}
      <pre
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: 12,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: 12,
          lineHeight: 1.45,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {ascii}
      </pre>
    </div>
  );
}
