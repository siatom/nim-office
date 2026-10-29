import { useMemo, useState } from "react";
import { Bot, Send, Settings2, X } from "lucide-react";
import { agentChat } from "../lib/ipc";

export interface AgentConfig { baseUrl: string; apiKey: string; model: string }
export interface AgentDocument { name: string; size: number; pageCount: number; text: string; headings: string[] }
type Message = { role: "user" | "assistant"; content: string };

export function readAgentConfig(): AgentConfig {
  try { return { baseUrl: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat", ...JSON.parse(localStorage.getItem("nim-office.agent-model") ?? "{}") }; }
  catch { return { baseUrl: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat" }; }
}

export function AgentPanel({ open, document, config, onClose, onSettings }: {
  open: boolean; document: AgentDocument | null; config: AgentConfig;
  onClose: () => void; onSettings: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = useMemo(() => {
    if (!document) return "当前没有打开的 Word 文档。";
    const metadata = `文档：${document.name}\n文件大小：${(document.size / 1024).toFixed(1)} KB\n页数：${document.pageCount}`;
    if (document.text.length <= 12000) return `${metadata}\n\n正文：\n${document.text}`;
    const outline = document.headings.length ? document.headings.map((h, i) => `${i + 1}. ${h}`).join("\n") : "（未识别到标题）";
    const sample = `${document.text.slice(0, 1800)}\n……\n${document.text.slice(-900)}`;
    return `${metadata}\n正文约 ${document.text.length} 字，采用目录和首尾摘要，未发送全文。\n目录：\n${outline}\n\n摘要采样：\n${sample}`;
  }, [document]);

  if (!open) return null;
  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next); setInput(""); setBusy(true); setError("");
    try {
      const answer = await agentChat(config.baseUrl, config.apiKey, config.model, [
          { role: "system", content: `你是 Word 文档阅读助手。只回答问题、总结或解释，不修改文档。根据需要使用提供的文档上下文；长文上下文可能仅包含目录和摘要，不能声称已阅读全文。\n\n${context}` },
          ...next,
        ]);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return <aside className="flex h-full w-[min(360px,38vw)] shrink-0 flex-col border-r border-line bg-surface shadow-card">
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
      <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent"><Bot size={16} /></span>
      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">文档智能体</div><div className="truncate text-[10px] text-ink-muted">{config.model || "未配置模型"}</div></div>
      <button title="模型设置" onClick={onSettings} className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-muted"><Settings2 size={15}/></button>
      <button title="关闭" onClick={onClose} className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-surface-muted"><X size={15}/></button>
    </header>
    <div className="border-b border-line bg-surface-muted px-4 py-2 text-[10.5px] text-ink-muted">{document ? `已读取「${document.name}」· ${document.pageCount} 页` : "打开 Word 文档后可基于文档提问"} · 只读模式</div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && <div className="rounded-xl border border-line bg-surface-muted p-3 text-[12px] leading-relaxed text-ink-muted">可以让我概括文档、查找观点或解释某段内容。长文会优先使用目录和摘要。</div>}
      {messages.map((message, i) => <div key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12px] leading-relaxed ${message.role === "user" ? "ml-auto bg-accent text-white" : "bg-surface-muted text-ink"}`}>{message.content}</div>)}
      {busy && <div className="text-[11px] text-ink-muted">正在思考…</div>}
      {error && <div role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[11px] text-danger">{error}</div>}
    </div>
    <div className="border-t border-line p-3">
      <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-muted p-2 focus-within:border-accent/60">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="询问当前文档…" rows={2} className="max-h-28 min-h-10 flex-1 resize-y bg-transparent px-1 py-1 text-[12px] outline-none placeholder:text-ink-subtle" />
        <button disabled={busy || !input.trim() || !config.model || !config.baseUrl} onClick={() => void send()} className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white disabled:opacity-40" title="发送"><Send size={15}/></button>
      </div>
      {!config.model && <button onClick={onSettings} className="mt-2 text-[10.5px] text-accent">配置模型以开始聊天</button>}
      <div className="mt-1.5 text-[9.5px] text-ink-subtle">按 Enter 发送，Shift + Enter 换行</div>
    </div>
  </aside>;
}
