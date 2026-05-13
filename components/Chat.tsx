'use client';

import { useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  cypher?: string;
  view?: 'graph' | 'list' | 'chart';
  error?: string;
  hint?: string;
};

type Props = {
  repoUrl?: string;
};

export default function Chat({ repoUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;

    const userMsg: ChatMessage = { role: 'user', text: q };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, repo_url: repoUrl }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: '',
            error: json.error ?? `Request failed (${res.status})`,
            hint: json.hint ?? json.message,
            cypher: json.cypher,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: json.answer ?? '',
            cypher: json.cypher,
            view: json.view,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: '',
          error: 'network_error',
          hint: err?.message ?? String(err),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card">
      <div className="chat-list">
        {messages.length === 0 && (
          <div style={{ color: '#8b949e', fontSize: 12 }}>
            Ask something about this repo. Examples: "What are the most-called
            functions?", "Show me the auth subsystem.", "Which file imports the
            most others?"
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="role">
              {m.role}
              {m.view && <span className="badge">{m.view}</span>}
            </div>
            {m.error ? (
              <div className="error-box" style={{ marginTop: 0 }}>
                {m.error}
                {m.hint && <div className="hint">{m.hint}</div>}
                {m.cypher && (
                  <details style={{ marginTop: 8 }}>
                    <summary>Show query</summary>
                    <pre>{m.cypher}</pre>
                  </details>
                )}
              </div>
            ) : (
              <>
                <div className="answer">{m.text}</div>
                {m.cypher && (
                  <details>
                    <summary>Show query</summary>
                    <pre>{m.cypher}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        ))}
        {sending && (
          <div className="chat-msg">
            <div className="role">assistant</div>
            <span className="spinner" /> &nbsp;thinking...
          </div>
        )}
      </div>

      <div className="row">
        <input
          type="text"
          placeholder={
            repoUrl ? 'Ask about this repo...' : 'Analyze a repo first, then ask...'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={sending}
          style={{ flex: 1 }}
        />
        <button onClick={send} disabled={sending || !input.trim()}>
          {sending ? <span className="spinner" /> : 'Send'}
        </button>
      </div>
    </div>
  );
}
