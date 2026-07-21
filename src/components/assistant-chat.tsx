"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Summarize my business performance.",
  "Which invoices need attention?",
  "Which products are low in stock?",
  "What should I focus on today?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I can analyze your live BizFlow data for free. On Vercel I use built-in business logic; when you run BizFlow locally, you can optionally connect Ollama." },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setQuestion("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, history: next.slice(-6) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The assistant could not answer.");
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_280px]">
      <section className="card flex min-h-[620px] flex-col p-0">
        <div className="flex items-center gap-3 border-b p-4 sm:p-5">
          <div className="rounded-xl bg-slate-950 p-2 text-white"><Bot size={20} /></div>
          <div><p className="font-black">BizFlow Intelligence</p><p className="text-xs text-slate-500">Answers are based on your current workspace data.</p></div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <div className="mt-1 hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 sm:grid"><Bot size={16}/></div>}
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-800"}`}>{message.content}</div>
              {message.role === "user" && <div className="mt-1 hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-white sm:grid"><User size={16}/></div>}
            </div>
          ))}
          {loading && <div className="flex gap-3"><div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">Analyzing your business data…</div></div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        </div>
        <form onSubmit={submit} className="border-t p-4 sm:p-5">
          <div className="flex gap-2">
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500} placeholder="Ask about revenue, overdue invoices, stock, customers…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); } }} />
            <button className="btn self-stretch px-4" disabled={loading || !question.trim()} aria-label="Send question"><Send size={18}/></button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Press Enter to send · Shift+Enter for a new line</p>
        </form>
      </section>
      <aside className="space-y-4">
        <section className="card">
          <div className="flex items-center gap-2"><Sparkles size={18}/><h2 className="font-black">Try asking</h2></div>
          <div className="mt-4 grid gap-2">
            {suggestions.map((item) => <button key={item} type="button" onClick={() => void ask(item)} disabled={loading} className="rounded-xl border bg-white p-3 text-left text-sm font-bold transition hover:bg-slate-50 disabled:opacity-60">{item}</button>)}
          </div>
        </section>
        <section className="card text-sm text-slate-600">
          <h2 className="font-black text-slate-900">Privacy</h2>
          <p className="mt-2 leading-6">Your Vercel deployment uses the built-in assistant and does not send business data to an external AI provider. Optional Ollama mode runs on your own computer.</p>
        </section>
      </aside>
    </div>
  );
}
