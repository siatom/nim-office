import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import { testAgentProvider } from "../lib/ipc";
import type { AgentProvider, AgentSettings } from "./AgentPanel";

export function SettingsDialog({
  open,
  autoSave,
  onAutoSaveChange,
  onClose,
  agentSettings,
  onAgentSettingsChange,
}: {
  open: boolean;
  autoSave: boolean;
  onAutoSaveChange: (enabled: boolean) => void;
  onClose: () => void;
  agentSettings: AgentSettings;
  onAgentSettingsChange: (settings: AgentSettings) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="关闭设置"
        className="anim-fade absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="anim-pop relative max-h-[90vh] w-[min(720px,calc(100vw-48px))] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <header className="flex items-start justify-between">
          <div>
            <h2 id="settings-title" className="text-[14px] font-semibold text-ink">设置</h2>
            <p className="mt-1 text-[12px] text-ink-muted">文档偏好与智能体模型</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭设置"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X size={15} />
          </button>
        </header>

        <div className="mt-5 rounded-xl border border-line bg-surface-muted p-3.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="auto-save-toggle" className="text-[12.5px] font-medium text-ink">
                自动保存
              </label>
              <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-ink-muted">
                停止编辑 1.5 秒后保存已命名的文档。新建文档首次保存时仍需选择位置。
              </p>
            </div>
            <button
              id="auto-save-toggle"
              type="button"
              role="switch"
              aria-checked={autoSave}
              onClick={() => onAutoSaveChange(!autoSave)}
              className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${autoSave ? "bg-accent" : "bg-line-strong"}`}
            >
              <span
                className={`absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-transform ${autoSave ? "translate-x-[19px]" : "translate-x-[3px]"}`}
              />
            </button>
          </div>
        </div>
        <AgentModelSettings settings={agentSettings} onChange={onAgentSettingsChange} />
      </section>
    </div>
  );
}

function AgentModelSettings({ settings, onChange }: { settings: AgentSettings; onChange: (value: AgentSettings) => void }) {
  const [editingId, setEditingId] = useState(settings.defaultProviderId);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const current = settings.providers.find((provider) => provider.id === editingId) ?? settings.providers[0];
  useEffect(() => {
    if (!settings.providers.some((provider) => provider.id === editingId)) setEditingId(settings.defaultProviderId);
  }, [editingId, settings.defaultProviderId, settings.providers]);

  const update = (patch: Partial<AgentProvider>) => {
    if (!current) return;
    onChange({ ...settings, providers: settings.providers.map((provider) => provider.id === current.id ? { ...provider, ...patch } : provider) });
    setNotice(null);
  };
  const addProvider = () => {
    const provider = { id: crypto.randomUUID(), name: "新供应商", baseUrl: "", apiKey: "", model: "" };
    onChange({ ...settings, providers: [...settings.providers, provider] });
    setEditingId(provider.id);
    setNotice(null);
  };
  const makeDefault = () => {
    if (!current) return;
    onChange({ ...settings, defaultProviderId: current.id });
  };
  const removeProvider = () => {
    if (!current || settings.providers.length <= 1) return;
    const providers = settings.providers.filter((provider) => provider.id !== current.id);
    const defaultProviderId = settings.defaultProviderId === current.id ? providers[0].id : settings.defaultProviderId;
    onChange({ providers, defaultProviderId });
    setEditingId(defaultProviderId);
    setNotice(null);
  };
  const test = async () => {
    if (!current) return;
    setTesting(true);
    setNotice(null);
    try {
      await testAgentProvider(current.baseUrl, current.apiKey, current.model);
      setNotice({ ok: true, text: "连接成功，模型响应正常" });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };
  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] text-ink outline-none focus:border-accent/60";
  return <section className="mt-4 rounded-xl border border-line bg-surface-muted p-3.5">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-[12.5px] font-semibold text-ink">模型与供应商</h3><p className="mt-1 text-[10.5px] text-ink-muted">支持 OpenAI Chat Completions 兼容接口。</p></div>
      <button type="button" onClick={addProvider} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-medium text-ink-muted hover:text-ink"><Plus size={14}/>添加 Provider</button>
    </div>

    <div className="mt-3 flex flex-wrap gap-1.5">
      {settings.providers.map((provider) => <button key={provider.id} type="button" onClick={() => { setEditingId(provider.id); setNotice(null); }} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors ${provider.id === current?.id ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-surface text-ink-muted hover:text-ink"}`}>
        {provider.name || "未命名"}{provider.id === settings.defaultProviderId && <Star size={11} className="fill-current"/>}
      </button>)}
    </div>

    {current && <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-medium text-ink-muted">Provider 名称<input className={input} value={current.name} onChange={(e) => update({ name: e.target.value })} placeholder="DeepSeek" /></label>
        <label className="block text-[11px] font-medium text-ink-muted">Base URL<input className={input} value={current.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} placeholder="https://api.deepseek.com" /></label>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-medium text-ink-muted">默认模型<input className={input} value={current.model} onChange={(e) => update({ model: e.target.value })} placeholder="deepseek-flash" /></label>
        <label className="block text-[11px] font-medium text-ink-muted">API Key<input type="password" autoComplete="off" className={input} value={current.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="可留空用于本地服务" /></label>
      </div>
      {notice && <div role="status" className={`mt-3 rounded-lg px-2.5 py-2 text-[11px] ${notice.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-danger/10 text-danger"}`}>{notice.text}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => void test()} disabled={testing || !current.baseUrl.trim() || !current.model.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-medium text-white disabled:opacity-45">{testing ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}测试连接</button>
        {current.id !== settings.defaultProviderId && <button type="button" onClick={makeDefault} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[11px] text-ink-muted hover:text-ink"><Check size={13}/>设为默认</button>}
        {settings.providers.length > 1 && <button type="button" onClick={removeProvider} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-danger hover:bg-danger/10"><Trash2 size={13}/>删除</button>}
      </div>
    </div>}
  </section>;
}
