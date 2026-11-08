"use client";

/**
 * frontend/src/app/ai/page.tsx
 *
 * AI Copilot Chat Page — grounded RAG Q&A with citation badges.
 *
 * Uses POST /api/ai/chat → { answer, citations, data_label, tools_used, confidence }
 */

import { useState, useRef, useEffect, FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { CopilotChatResponse, CopilotAuditEntry } from "@/lib/api/types";

// ── Message shape for local chat history ────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: CopilotChatResponse;
  timestamp: Date;
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

function DataLabelBadge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    CITED_DOCUMENT: "bg-emerald-900 border-emerald-700 text-emerald-300",
    SIMULATED: "bg-blue-900 border-blue-700 text-blue-300",
    UNCERTAIN: "bg-amber-900 border-amber-700 text-amber-300",
    INSUFFICIENT_EVIDENCE: "bg-red-900 border-red-700 text-red-300",
  };
  const cls =
    styles[label] ?? "bg-gray-800 border-gray-700 text-gray-400";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-mono font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function CitationBadge({ cite, idx }: { cite: string; idx: number }) {
  return (
    <span
      title={cite}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 font-mono max-w-[260px] truncate"
    >
      <span className="text-emerald-400 shrink-0">[{idx + 1}]</span>
      {cite}
    </span>
  );
}

function ToolBadge({ tool }: { tool: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-indigo-900 border border-indigo-700 rounded text-xs text-indigo-300 font-mono">
      ⚙ {tool}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Confidence</span>
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono">{pct}%</span>
    </div>
  );
}

// ── Audit Log Panel ──────────────────────────────────────────────────────────

function AuditPanel({ entries }: { entries: CopilotAuditEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {open ? "▼" : "▶"} Tool audit log ({entries.length} calls)
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-gray-900 border border-gray-800 p-3 space-y-2 text-xs font-mono">
          {entries.map((e, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">⚙ {e.tool_name}</span>
                <span
                  className={
                    e.approved
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  {e.approved ? "✓ approved" : "✗ blocked"}
                </span>
                <span className="text-gray-600">{e.timestamp}</span>
              </div>
              {e.result_summary && (
                <span className="text-gray-500 pl-4 truncate">
                  {e.result_summary}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assistant Message Bubble ─────────────────────────────────────────────────

function AssistantBubble({ msg }: { msg: ChatMessage }) {
  const r = msg.response;
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl rounded-tl-sm bg-gray-900 border border-gray-800 px-5 py-4 max-w-3xl">
        {/* Answer text — simple newline-aware rendering */}
        <div className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.text}
        </div>

        {r && (
          <div className="mt-3 space-y-2">
            {/* Data label + confidence */}
            <div className="flex flex-wrap items-center gap-2">
              <DataLabelBadge label={r.data_label} />
              <ConfidenceBar value={r.confidence} />
            </div>

            {/* Citations */}
            {r.citations.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Sources</span>
                <div className="flex flex-wrap gap-1">
                  {r.citations.map((c, i) => (
                    <CitationBadge key={i} cite={c} idx={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Tools used */}
            {r.tools_used.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.tools_used.map((t) => (
                  <ToolBadge key={t} tool={t} />
                ))}
              </div>
            )}

            {/* Audit log */}
            {r.audit_log && <AuditPanel entries={r.audit_log} />}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-700 pl-1">
        {msg.timestamp.toLocaleTimeString()}
      </span>
    </div>
  );
}

// ── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTED: string[] = [
  "What are the peak hour volume and bus priority plans for Silk Board in Bengaluru?",
  "Explain the signal timing recommendations for Jaipur MI Road.",
  "What infrastructure improvements are planned in the Delhi Master Plan 2041?",
  "What does the Bengaluru CMP 2035 recommend for Outer Ring Road signal cycles?",
  "Compare the BPR travel time for baseline vs road closure scenarios.",
  "What does the Jaipur CMP 2025 say about transit corridors?",
];

// ── City selector ────────────────────────────────────────────────────────────

const CITIES = [
  { id: "jaipur", name: "Jaipur" },
  { id: "delhi", name: "Delhi" },
  { id: "bengaluru", name: "Bengaluru" },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AICopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [cityId, setCityId] = useState("jaipur");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.copilotChat({ query, city_id: cityId });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: res.answer,
        response: res,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reach AI Copilot";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion(s: string) {
    setInput(s);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="py-5 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span> AI Copilot
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Grounded RAG — answers backed by planning documents &amp; live
            simulation data
          </p>
        </div>
        {/* City selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">City context</span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="text-5xl">🏙️</div>
            <div className="space-y-1">
              <p className="text-gray-300 font-medium">
                Ask anything about urban planning or traffic simulation
              </p>
              <p className="text-gray-600 text-sm">
                Answers are grounded in indexed planning documents and real
                simulation results — no hallucinations.
              </p>
            </div>
            {/* Suggested prompts */}
            <div className="grid gap-2 max-w-xl w-full">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => applySuggestion(s)}
                  className="text-left px-4 py-2.5 bg-gray-900 border border-gray-800 hover:border-emerald-700 hover:text-emerald-300 rounded-xl text-sm text-gray-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-2xl rounded-tr-sm bg-emerald-800 border border-emerald-700 px-4 py-3 max-w-xl text-white text-sm">
                  {msg.text}
                </div>
                <span className="text-xs text-gray-700 pr-1">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-start">
              <AssistantBubble msg={msg} />
            </div>
          )
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-gray-900 border border-gray-800 px-5 py-4">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                <span className="text-xs text-gray-600 ml-2">
                  Copilot thinking…
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
              ⚠ {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-800 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about traffic, urban planning, simulation results…"
            disabled={loading}
            className="flex-1 bg-gray-900 border border-gray-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </form>
        <p className="text-xs text-gray-700 mt-2 text-center">
          Urbynex AI Copilot · Zero-fabrication policy · All answers cite
          source documents or simulation data
        </p>
      </div>
    </div>
  );
}
