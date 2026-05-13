'use client';

import { useState } from 'react';

type Props = {
  onAnalyze: (url: string) => void;
  loading?: boolean;
};

const QUICK_PICKS = [
  'psf/requests',
  'pallets/flask',
  'tiangolo/fastapi',
];

export default function RepoInput({ onAnalyze, loading }: Props) {
  const [url, setUrl] = useState('');

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    onAnalyze(trimmed);
  };

  const pick = (slug: string) => {
    const full = `https://github.com/${slug}`;
    setUrl(full);
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          style={{ flex: 1, minWidth: 240 }}
          disabled={loading}
        />
        <button onClick={submit} disabled={loading || !url.trim()}>
          {loading ? (
            <>
              <span className="spinner" /> &nbsp;Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
      <div className="row">
        <span style={{ fontSize: 12, color: '#8b949e' }}>Try:</span>
        {QUICK_PICKS.map((slug) => (
          <button
            key={slug}
            className="secondary"
            onClick={() => pick(slug)}
            disabled={loading}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {slug}
          </button>
        ))}
      </div>
    </div>
  );
}
