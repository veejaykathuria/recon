'use client';

import { useEffect, useState, useCallback } from 'react';

const SLIDE_COUNT = 6;

export default function PitchPage() {
  const [idx, setIdx] = useState(0);

  const next = useCallback(() => setIdx((i) => Math.min(SLIDE_COUNT - 1, i + 1)), []);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End') setIdx(SLIDE_COUNT - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const Slide = SLIDES[idx];

  return (
    <div className="pitch-root">
      <Slide />
      <Controls idx={idx} prev={prev} next={next} setIdx={setIdx} />
      <style jsx global>{`
        body {
          background: #07090d;
          color: #e6edf3;
        }
      `}</style>
      <style jsx>{`
        .pitch-root {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background:
            radial-gradient(900px 600px at 20% 10%, rgba(255, 92, 56, 0.08), transparent 60%),
            radial-gradient(900px 600px at 80% 90%, rgba(80, 140, 255, 0.08), transparent 60%),
            radial-gradient(900px 600px at 50% 50%, rgba(170, 110, 255, 0.06), transparent 60%),
            #07090d;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

function Controls({
  idx,
  prev,
  next,
  setIdx,
}: {
  idx: number;
  prev: () => void;
  next: () => void;
  setIdx: (i: number) => void;
}) {
  return (
    <>
      <div className="controls">
        <button onClick={prev} disabled={idx === 0} aria-label="Previous slide">
          ←
        </button>
        <div className="dots">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <button
              key={i}
              className={`dot ${i === idx ? 'active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <button onClick={next} disabled={idx === SLIDE_COUNT - 1} aria-label="Next slide">
          →
        </button>
        <span className="counter">
          {idx + 1} / {SLIDE_COUNT}
        </span>
      </div>
      <style jsx>{`
        .controls {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(13, 17, 23, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          padding: 8px 16px;
          z-index: 10;
        }
        .controls button {
          background: transparent;
          color: #e6edf3;
          border: none;
          font-size: 18px;
          padding: 4px 10px;
          cursor: pointer;
          border-radius: 6px;
        }
        .controls button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .controls button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
        }
        .dots {
          display: flex;
          gap: 6px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          padding: 0;
        }
        .dot.active {
          background: #e6edf3;
          width: 22px;
          border-radius: 4px;
        }
        .counter {
          color: #8b949e;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          min-width: 36px;
          text-align: center;
        }
      `}</style>
    </>
  );
}

/* =========================================================
   SLIDES
   ========================================================= */

function SlideShell({
  children,
  number,
  total = SLIDE_COUNT,
}: {
  children: React.ReactNode;
  number: number;
  total?: number;
}) {
  return (
    <div className="slide">
      <div className="slide-inner">{children}</div>
      <div className="slide-meta">
        <span>RECON · Hackathon Demo</span>
        <span>
          {number} / {total}
        </span>
      </div>
      <style jsx>{`
        .slide {
          width: min(1280px, 92vw);
          height: min(720px, 82vh);
          padding: 56px 72px;
          border-radius: 24px;
          background: linear-gradient(160deg, #0f1419 0%, #0a0d12 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .slide-inner {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .slide-meta {
          position: absolute;
          bottom: 20px;
          left: 72px;
          right: 72px;
          display: flex;
          justify-content: space-between;
          color: #6e7681;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

function Slide1Title() {
  return (
    <SlideShell number={1}>
      <div className="hero">
        <div className="eyebrow">A code-analysis agent</div>
        <h1 className="title">
          RECON<span className="dot">.</span>
        </h1>
        <p className="tagline">
          Ask any Python repo a question. <span className="accent">Get a real answer.</span>
        </p>
        <div className="meta-row">
          <span className="pill">Built in 2 hours</span>
          <span className="pill">Zero paid LLM credits</span>
        </div>
        <div className="sponsors">
          <SponsorBadge color="#ff5c38" emoji="🌶️" name="Kimchi" sub="the brain" />
          <SponsorBadge color="#508cff" emoji="🔵" name="Neo4j" sub="the memory" />
          <SponsorBadge color="#aa6eff" emoji="🟣" name="Tessl" sub="correctness" />
        </div>
      </div>
      <style jsx>{`
        .hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 18px;
        }
        .eyebrow {
          color: #8b949e;
          font-size: 14px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .title {
          font-size: 168px;
          line-height: 0.9;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin: 0;
          background: linear-gradient(180deg, #fff 0%, #8b949e 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .dot {
          color: #ff5c38;
          -webkit-text-fill-color: #ff5c38;
        }
        .tagline {
          font-size: 28px;
          color: #c9d1d9;
          margin: 8px 0 0;
          max-width: 720px;
          line-height: 1.3;
        }
        .accent {
          color: #fff;
        }
        .meta-row {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }
        .pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #c9d1d9;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
        }
        .sponsors {
          display: flex;
          gap: 18px;
          margin-top: 28px;
        }
      `}</style>
    </SlideShell>
  );
}

function SponsorBadge({
  color,
  emoji,
  name,
  sub,
}: {
  color: string;
  emoji: string;
  name: string;
  sub: string;
}) {
  return (
    <div className="badge">
      <span className="emoji">{emoji}</span>
      <div className="text">
        <div className="name" style={{ color }}>
          {name}
        </div>
        <div className="sub">{sub}</div>
      </div>
      <style jsx>{`
        .badge {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
        }
        .emoji {
          font-size: 24px;
        }
        .name {
          font-size: 16px;
          font-weight: 700;
        }
        .sub {
          color: #8b949e;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

function Slide2Problem() {
  return (
    <SlideShell number={2}>
      <SlideHeader eyebrow="The problem" title="Joining a Python repo is still painful." />
      <div className="grid">
        <div className="card">
          <div className="card-title">The maze</div>
          <div className="filetree">
            {[
              '📁 src/',
              '  📁 auth/',
              '    📄 oauth.py',
              '    📄 session.py',
              '    📄 tokens.py',
              '  📁 api/',
              '    📄 routes.py',
              '    📄 middleware.py',
              '  📁 db/',
              '    📄 …',
              '  …  ⤴ 400+ more files',
            ].map((line, i) => (
              <div key={i} className="line">
                {line}
              </div>
            ))}
          </div>
          <div className="caption">Where does the auth flow live? You don't know.</div>
        </div>
        <div className="card chat">
          <div className="card-title">Asking the LLM</div>
          <div className="bubble user">Where does the auth flow live in this repo?</div>
          <div className="bubble bot">
            I don't have access to that repository. I'd need you to share specific files or
            describe the code structure for me to help.
          </div>
          <div className="caption red">Useless. No access. No structure. No grounding.</div>
        </div>
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          flex: 1;
          margin-top: 24px;
        }
        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 22px 26px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .card-title {
          color: #8b949e;
          font-size: 12px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .filetree {
          font-family: 'SF Mono', Menlo, Consolas, monospace;
          font-size: 14px;
          line-height: 1.7;
          color: #c9d1d9;
        }
        .filetree .line:last-child {
          color: #ff5c38;
        }
        .caption {
          color: #8b949e;
          font-size: 14px;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
        }
        .caption.red {
          color: #ff7a5c;
        }
        .chat {
          gap: 12px;
        }
        .bubble {
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.5;
          max-width: 85%;
        }
        .bubble.user {
          align-self: flex-end;
          background: #1f6feb;
          color: white;
        }
        .bubble.bot {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </SlideShell>
  );
}

function Slide3Graph() {
  return (
    <SlideShell number={3}>
      <SlideHeader
        eyebrow="Demo · Step 1"
        title={
          <>
            Paste a repo. Get a <span style={{ color: '#508cff' }}>real graph.</span>
          </>
        }
      />
      <div className="row">
        <div className="left">
          <div className="urlbar">
            <span className="prefix">github.com/</span>
            <span className="repo">pallets/click</span>
          </div>
          <div className="summary">
            <Stat label="Files" value="178" />
            <Stat label="Functions" value="1,402" />
            <Stat label="Subsystems" value="6" />
          </div>
          <div className="legend">
            {SUBSYSTEMS.map((s) => (
              <div key={s.name} className="leg">
                <span className="swatch" style={{ background: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
          <p className="explain">
            Clones repo → parses every <code>.py</code> file's AST → writes{' '}
            <code>(:File)</code>, <code>(:Function)</code>, <code>:CALLS</code>,{' '}
            <code>:IMPORTS</code> into Neo4j. Then Kimchi labels the clusters.
          </p>
        </div>
        <div className="right">
          <FakeGraph />
        </div>
      </div>
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 36px;
          flex: 1;
          margin-top: 20px;
          min-height: 0;
        }
        .left {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .urlbar {
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 12px 16px;
          font-family: 'SF Mono', Menlo, Consolas, monospace;
          font-size: 16px;
        }
        .prefix {
          color: #8b949e;
        }
        .repo {
          color: #fff;
          font-weight: 600;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .legend {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 16px;
        }
        .leg {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #c9d1d9;
        }
        .swatch {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .explain {
          color: #8b949e;
          font-size: 13px;
          line-height: 1.6;
          margin: auto 0 0;
        }
        .explain code {
          font-family: 'SF Mono', Menlo, Consolas, monospace;
          color: #c9d1d9;
          background: rgba(255, 255, 255, 0.06);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
        .right {
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }
      `}</style>
    </SlideShell>
  );
}

const SUBSYSTEMS = [
  { name: 'core',       color: '#508cff' },
  { name: 'parsing',    color: '#ff5c38' },
  { name: 'decorators', color: '#aa6eff' },
  { name: 'completion', color: '#3ed598' },
  { name: 'termui',     color: '#ffb454' },
  { name: 'utils',      color: '#ff5cab' },
];

function FakeGraph() {
  const nodes = [
    { x: 50, y: 50, r: 24, c: 0, label: 'Context' },
    { x: 22, y: 32, r: 10, c: 0 },
    { x: 30, y: 65, r: 12, c: 0 },
    { x: 70, y: 30, r: 14, c: 1, label: 'parse' },
    { x: 82, y: 45, r: 9, c: 1 },
    { x: 78, y: 18, r: 8, c: 1 },
    { x: 20, y: 80, r: 13, c: 2 },
    { x: 35, y: 88, r: 8, c: 2 },
    { x: 78, y: 78, r: 11, c: 3 },
    { x: 88, y: 65, r: 9, c: 3 },
    { x: 55, y: 85, r: 10, c: 4 },
    { x: 12, y: 50, r: 8, c: 5 },
    { x: 8, y: 20, r: 7, c: 5 },
    { x: 92, y: 88, r: 7, c: 3 },
    { x: 60, y: 18, r: 9, c: 1 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 3], [0, 6], [0, 8], [0, 10],
    [3, 4], [3, 5], [3, 14],
    [6, 7], [6, 11], [11, 12], [8, 9], [8, 13],
    [10, 6], [10, 8],
  ];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.25"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r / 8}
            fill={SUBSYSTEMS[n.c].color}
            opacity={0.95}
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r / 8 + 1.2}
            fill="none"
            stroke={SUBSYSTEMS[n.c].color}
            strokeWidth="0.2"
            opacity={0.3}
          />
          {n.label && (
            <text
              x={n.x}
              y={n.y - n.r / 8 - 1.5}
              fontSize="2.2"
              fill="#e6edf3"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      <style jsx>{`
        .stat {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 12px 14px;
          text-align: center;
        }
        .v {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }
        .l {
          font-size: 11px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

function Slide4Chat() {
  return (
    <SlideShell number={4}>
      <SlideHeader
        eyebrow="Demo · Step 2"
        title={
          <>
            Ask in English. <span style={{ color: '#aa6eff' }}>No hallucination.</span>
          </>
        }
      />
      <div className="row">
        <div className="chat-col">
          <div className="bubble user">What are the 5 most-called functions?</div>
          <div className="show-query">
            <div className="show-query-label">▾ Show query</div>
            <pre>{`MATCH (f:Function)<-[c:CALLS]-()
WHERE EXISTS {
  (f)-[:DEFINED_IN]->(:File)
     -[:DEFINED_IN]->(:Repo {url:$repo_url})
}
RETURN f.qname, count(c) AS n
ORDER BY n DESC LIMIT 5;`}</pre>
          </div>
          <div className="results">
            {[
              ['Context.invoke', 43],
              ['Command.parse_args', 31],
              ['Option.handle_parse_result', 28],
              ['Context.fail', 22],
              ['utils.echo', 19],
            ].map(([q, n]) => (
              <div className="result-row" key={q as string}>
                <code>{q}</code>
                <span className="count">{n}</span>
              </div>
            ))}
          </div>
          <div className="bubble bot">
            <strong>Context.invoke</strong> is the most-called function (43 callers), reflecting
            Click's command-dispatch design where every subcommand routes through a shared
            context.
          </div>
        </div>
        <div className="flow-col">
          <FlowStep
            n="1"
            color="#ff5c38"
            label="Kimchi"
            text="Generates Cypher from English. Grounded by the Tessl recon-schema Skill."
          />
          <Connector />
          <FlowStep
            n="2"
            color="#aa6eff"
            label="Tessl"
            text="Skill enforces modern Cypher 25 and Recon's exact node/edge model."
          />
          <Connector />
          <FlowStep
            n="3"
            color="#508cff"
            label="Neo4j"
            text="Query runs on a real graph. Returns real rows. Not vibes."
          />
          <Connector />
          <FlowStep
            n="4"
            color="#ff5c38"
            label="Kimchi"
            text="Composes English answer from the rows. Sources are cited inline."
          />
        </div>
      </div>
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 28px;
          flex: 1;
          margin-top: 20px;
          min-height: 0;
        }
        .chat-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: hidden;
        }
        .bubble {
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.5;
        }
        .bubble.user {
          align-self: flex-end;
          background: #1f6feb;
          color: white;
          max-width: 80%;
        }
        .bubble.bot {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .show-query {
          background: #0d1117;
          border: 1px solid rgba(170, 110, 255, 0.3);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .show-query-label {
          color: #aa6eff;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        pre {
          font-family: 'SF Mono', Menlo, Consolas, monospace;
          font-size: 11.5px;
          line-height: 1.45;
          color: #c9d1d9;
          margin: 0;
          white-space: pre-wrap;
        }
        .results {
          background: rgba(80, 140, 255, 0.05);
          border: 1px solid rgba(80, 140, 255, 0.2);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .result-row {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          padding: 3px 0;
        }
        .result-row code {
          font-family: 'SF Mono', Menlo, Consolas, monospace;
          color: #c9d1d9;
        }
        .count {
          color: #508cff;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }
        .flow-col {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
      `}</style>
    </SlideShell>
  );
}

function FlowStep({
  n,
  color,
  label,
  text,
}: {
  n: string;
  color: string;
  label: string;
  text: string;
}) {
  return (
    <div className="step">
      <div className="num" style={{ background: color }}>
        {n}
      </div>
      <div className="body">
        <div className="lbl" style={{ color }}>
          {label}
        </div>
        <div className="txt">{text}</div>
      </div>
      <style jsx>{`
        .step {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .num {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: white;
          font-weight: 700;
          font-size: 13px;
          display: grid;
          place-items: center;
        }
        .body {
          flex: 1;
        }
        .lbl {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .txt {
          color: #c9d1d9;
          font-size: 12.5px;
          line-height: 1.45;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}

function Connector() {
  return (
    <div className="conn">
      <style jsx>{`
        .conn {
          width: 1px;
          height: 14px;
          background: rgba(255, 255, 255, 0.15);
          margin-left: 14px;
        }
      `}</style>
    </div>
  );
}

function Slide5Stack() {
  return (
    <SlideShell number={5}>
      <SlideHeader eyebrow="The stack" title="Every sponsor is load-bearing." />
      <div className="cols">
        <StackCol
          color="#ff5c38"
          emoji="🌶️"
          name="Kimchi"
          role="the brain"
          rows={[
            ['Model', 'Kimi K2.5 · 262k ctx'],
            ['Build time', 'Claude Code runs on Kimchi'],
            ['Runtime', 'labels subsystems + writes Cypher'],
            ['Cost', '$0'],
          ]}
        />
        <StackCol
          color="#508cff"
          emoji="🔵"
          name="Neo4j"
          role="the memory"
          rows={[
            ['Tier', 'Aura free'],
            ['Build time', 'MCP server → direct queries'],
            ['Runtime', 'neo4j-driver writes + reads'],
            ['Schema', '4 node types · 5 edge types'],
          ]}
        />
        <StackCol
          color="#aa6eff"
          emoji="🟣"
          name="Tessl"
          role="correctness"
          rows={[
            ['Skill #1', 'neo4j-skills (Cypher 25)'],
            ['Skill #2', 'anthropics/skills'],
            ['Skill #3', 'recon-schema (ours)'],
            ['Effect', 'every query valid · no deprecated syntax'],
          ]}
        />
      </div>
      <div className="quote">
        "Claude Code on Kimchi's free model · querying my Neo4j graph · Tessl keeping the queries
        correct."
      </div>
      <style jsx>{`
        .cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          flex: 1;
          margin-top: 22px;
        }
        .quote {
          color: #8b949e;
          font-style: italic;
          font-size: 14px;
          text-align: center;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </SlideShell>
  );
}

function StackCol({
  color,
  emoji,
  name,
  role,
  rows,
}: {
  color: string;
  emoji: string;
  name: string;
  role: string;
  rows: [string, string][];
}) {
  return (
    <div className="col" style={{ ['--c' as string]: color }}>
      <div className="head">
        <span className="e">{emoji}</span>
        <div>
          <div className="n">{name}</div>
          <div className="r">{role}</div>
        </div>
      </div>
      <div className="rows">
        {rows.map(([k, v]) => (
          <div className="row" key={k}>
            <div className="k">{k}</div>
            <div className="v">{v}</div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .col {
          background: linear-gradient(180deg, color-mix(in srgb, var(--c) 12%, transparent), transparent 60%),
            rgba(255, 255, 255, 0.02);
          border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
          border-radius: 16px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .head {
          display: flex;
          gap: 12px;
          align-items: center;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .e {
          font-size: 28px;
        }
        .n {
          color: var(--c);
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .r {
          color: #8b949e;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .k {
          font-size: 11px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .v {
          font-size: 14px;
          color: #e6edf3;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function Slide6Close() {
  return (
    <SlideShell number={6}>
      <div className="close">
        <div className="big">
          Try it. <span className="accent">Now.</span>
        </div>
        <div className="links">
          <Link label="Live demo" value="recon-silk.vercel.app" color="#3ed598" />
          <Link label="Source" value="github.com/veejaykathuria/recon" color="#508cff" />
        </div>
        <div className="sponsors">
          <SponsorBadge color="#ff5c38" emoji="🌶️" name="Kimchi" sub="free LLM, build + runtime" />
          <SponsorBadge color="#508cff" emoji="🔵" name="Neo4j" sub="real graph, real queries" />
          <SponsorBadge color="#aa6eff" emoji="🟣" name="Tessl" sub="correctness on rails" />
        </div>
        <div className="thanks">
          Thanks to <span style={{ color: '#ff5c38' }}>Kimchi</span>,{' '}
          <span style={{ color: '#508cff' }}>Neo4j</span>, and{' '}
          <span style={{ color: '#aa6eff' }}>Tessl</span>.
        </div>
      </div>
      <style jsx>{`
        .close {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 36px;
        }
        .big {
          font-size: 96px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .accent {
          color: #3ed598;
        }
        .links {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sponsors {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .thanks {
          color: #8b949e;
          font-size: 18px;
        }
      `}</style>
    </SlideShell>
  );
}

function Link({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="link">
      <span className="l">{label}</span>
      <span className="v" style={{ color }}>
        {value}
      </span>
      <style jsx>{`
        .link {
          display: flex;
          align-items: baseline;
          gap: 16px;
          font-family: 'SF Mono', Menlo, Consolas, monospace;
        }
        .l {
          color: #8b949e;
          font-size: 14px;
          min-width: 120px;
        }
        .v {
          font-size: 26px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function SlideHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="header">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="title">{title}</h2>
      <style jsx>{`
        .header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .eyebrow {
          color: #8b949e;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .title {
          font-size: 48px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          color: #fff;
        }
      `}</style>
    </div>
  );
}

const SLIDES = [Slide1Title, Slide2Problem, Slide3Graph, Slide4Chat, Slide5Stack, Slide6Close];
