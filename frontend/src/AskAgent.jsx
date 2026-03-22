import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://shiny-disco-vx45rvgq4gq36p5q-8000.app.github.dev";

const SUGGESTIONS = [
  "Which date had highest solar generation?",
  "What was peak demand last week?",
  "Which day had lowest grid frequency?",
  "Which date had maximum wind generation?",
  "What is average daily thermal generation?",
];

export default function AskAgent() {
  const [open, setOpen]         = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [stats, setStats]       = useState(null);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  // fetch token stats on open
  useEffect(() => {
    if (open) {
      axios.get(`${API}/token-stats`).then(r => setStats(r.data)).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function submit(q) {
    const text = (q || question).trim();
    if (!text || loading) return;

    setMessages(m => [...m, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/ask`, { question: text });
      const { answer, error, tokens_used } = res.data;
      setMessages(m => [...m, {
        role: "agent",
        text: error ? error : answer,
        isError: !!error,
        tokens: tokens_used,
      }]);
      // refresh stats after each call
      axios.get(`${API}/token-stats`).then(r => setStats(r.data)).catch(() => {});
    } catch {
      setMessages(m => [...m, { role: "agent", text: "Could not reach API.", isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Token bar ──────────────────────────────────────────────────────────────
  const TokenBar = () => {
    if (!stats) return null;
    const pct = Math.min(100, (stats.today_tokens / stats.daily_limit) * 100);
    const color = pct > 80 ? "#E8623A" : pct > 50 ? "#F5A623" : "#2ECC71";
    return (
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#555" }}>
            Today: {stats.today_tokens.toLocaleString()} / {stats.daily_limit.toLocaleString()} tokens
          </span>
          <span style={{ fontSize: 10, color: "#555" }}>
            Total cost: ${stats.total_cost_usd}
          </span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
          ~{stats.tokens_until_dollar.toLocaleString()} tokens until $1 spent
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          height: 44, borderRadius: 22,
          padding: "0 18px",
          background: open ? "#2a2a2a" : "#6C63FF",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
          color: "#fff",
          display: "flex", alignItems: "center", gap: 8,
          transition: "all 0.2s",
        }}
      >
        <span style={{ fontSize: 16 }}>{open ? "×" : "✦"}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {open ? "Close" : "Ask the data"}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 999,
          width: 360, maxHeight: 520,
          background: "#0f0f16",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Header */}
          <div style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: "rgba(108,99,255,0.2)",
                border: "1px solid rgba(108,99,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12,
              }}>✦</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>Ask the data</span>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} style={{
                fontSize: 11, color: "#444", background: "none",
                border: "none", cursor: "pointer", padding: 0,
              }}>clear</button>
            )}
          </div>

          {/* Token bar */}
          <TokenBar />

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 10,
            minHeight: 120,
          }}>
            {/* Suggestions */}
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => submit(s)} style={{
                    padding: "7px 10px", borderRadius: 8, fontSize: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#777", cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color="#a99fff"; e.currentTarget.style.borderColor="rgba(108,99,255,0.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color="#777"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; }}
                  >{s}</button>
                ))}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%", padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: msg.role === "user"
                    ? "rgba(108,99,255,0.25)"
                    : msg.isError ? "rgba(220,50,50,0.15)" : "rgba(255,255,255,0.05)",
                  border: msg.role === "user"
                    ? "1px solid rgba(108,99,255,0.35)"
                    : msg.isError ? "1px solid rgba(220,50,50,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  fontSize: 13, color: msg.isError ? "#ff8888" : "#ddd",
                  lineHeight: 1.6,
                }}>
                  {msg.text}
                  {msg.tokens > 0 && (
                    <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                      {msg.tokens} tokens
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking bubble */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  padding: "8px 12px", borderRadius: "12px 12px 12px 4px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 13, color: "#555",
                }}>Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", gap: 8,
          }}>
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && submit()}
              placeholder="Ask anything…"
              disabled={loading || stats?.daily_limit_reached}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 13, outline: "none",
              }}
            />
            <button
              onClick={() => submit()}
              disabled={loading || !question.trim() || stats?.daily_limit_reached}
              style={{
                padding: "8px 14px", borderRadius: 8,
                background: loading || !question.trim() ? "#1a1a1a" : "#6C63FF",
                color: loading || !question.trim() ? "#444" : "#fff",
                border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}
            >→</button>
          </div>
        </div>
      )}
    </>
  );
}