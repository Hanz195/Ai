"use client";

import { useEffect, useRef, useState } from "react";
import "./ChatBot.css";

export default function ChatBot({ endpoint = "/api/chat", title = "AF. AI" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    const next = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("Permintaan gagal");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setMessages((prev) => prev.filter((m) => m.content !== ""));
      } else {
        setMessages(next);
        setInput(text);
        setError("Pesan belum terkirim. Periksa koneksi, lalu kirim lagi.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setError("");
  }

  return (
    <div className="af-app">
      <section className="af-card" aria-label={title}>
        <header className="af-header">
          <div className="af-brand">
            <span className="af-icon">🧠</span>
            <span className="af-title">{title}</span>
          </div>
          <div className="af-subtitle">
            <p>Tanya apa saja.</p>
            <p>Enter untuk kirim, Shift+Enter untuk baris baru.</p>
          </div>
        </header>

        <div className="af-log" role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="af-empty">
              <p className="af-empty-title">Tanya apa saja.</p>
              <p className="af-empty-hint">
                Enter untuk kirim, Shift+Enter untuk baris baru.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`af-msg af-${m.role}`}>
                <div className="af-bubble">
                  {m.content ||
                    (loading && i === messages.length - 1 ? (
                      <span className="af-typing" aria-label="Sedang mengetik">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null)}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p className="af-error" role="alert">{error}</p>
        )}

        <form className="af-form" onSubmit={send}>
          <textarea
            ref={textareaRef}
            className="af-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tulis pesan…"
            aria-label="Pesan"
          />
          {loading ? (
            <button type="button" className="af-send af-stop" onClick={stop}>
              Berhenti
            </button>
          ) : (
            <button type="submit" className="af-send" disabled={!input.trim()}>
              Kirim
            </button>
          )}
        </form>
      </section>
    </div>
  );
}