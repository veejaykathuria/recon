'use client';

import { useState } from 'react';

type Props = {
  ascii: string;
};

export default function DataflowAscii({ ascii }: Props) {
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
      await navigator.clipboard.writeText(ascii);
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
        }}
      >
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          Subsystem boxes + top cross-subsystem call edges, in plain ASCII.
          Copy-paste into a README or chat.
        </span>
        <button onClick={copy} style={{ minWidth: 80 }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
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
