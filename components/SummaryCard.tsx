'use client';

export type Subsystem = {
  name: string;
  color: string;
  function_count: number;
  description: string;
};

export type AnalyzeResult = {
  repo: { url: string; name: string; sha: string };
  counts: { files: number; functions: number; calls: number; subsystems: number };
  subsystems: Subsystem[];
  dataflow_ascii?: string;
  dataflow_narrative?: string;
  truncated: boolean;
};

type Props = {
  result: AnalyzeResult;
};

export default function SummaryCard({ result }: Props) {
  const { repo, counts, subsystems, truncated } = result;

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <strong>{repo.name}</strong>{' '}
          <span style={{ color: '#8b949e', fontSize: 12 }}>
            {repo.sha ? `@ ${repo.sha.slice(0, 7)}` : ''}
          </span>
        </div>
        {truncated && (
          <span className="badge" style={{ background: '#9e6a03', color: '#fff' }}>
            truncated
          </span>
        )}
      </div>

      <div className="counts">
        <div className="count-box">
          <span className="num">{counts.files}</span>
          <span className="label">Files</span>
        </div>
        <div className="count-box">
          <span className="num">{counts.functions}</span>
          <span className="label">Functions</span>
        </div>
        <div className="count-box">
          <span className="num">{counts.calls}</span>
          <span className="label">Calls</span>
        </div>
        <div className="count-box">
          <span className="num">{counts.subsystems}</span>
          <span className="label">Subsystems</span>
        </div>
      </div>

      {subsystems.length > 0 ? (
        <div className="row">
          {subsystems.map((s) => (
            <span
              key={s.name}
              className="chip subsystem"
              title={s.description}
              style={{
                borderColor: s.color,
                background: `${s.color}22`,
              }}
            >
              <span className="dot" style={{ background: s.color }} />
              {s.name}
              <span style={{ color: '#8b949e', marginLeft: 4 }}>
                ({s.function_count})
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ color: '#8b949e', fontSize: 12 }}>
          No subsystems labelled (uncategorized).
        </div>
      )}
    </div>
  );
}
