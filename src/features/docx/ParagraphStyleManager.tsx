import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useDocxEditor, useParagraphStyle } from "@docx-editor.dev/react";

import {
  readParagraphStyleDraft,
  writeParagraphStyle,
  type ParagraphStyleDraft,
} from "./paragraph-style-package";
import { getDisplayName } from "./ParagraphStylePicker";

const EMPTY_DRAFT: ParagraphStyleDraft = {
  name: "",
  basedOn: "",
  fontFamily: "",
  fontSizePt: "",
  bold: "inherit",
  italic: "inherit",
  color: "",
  alignment: "",
  spaceBeforePt: "",
  spaceAfterPt: "",
  indentLeftPt: "",
  firstLineIndentPt: "",
};

function draftForNewStyle(baseStyleId: string, options: ReturnType<typeof useParagraphStyle>["options"]): ParagraphStyleDraft {
  const base = options.find((option) => option.styleId === baseStyleId);
  return {
    ...EMPTY_DRAFT,
    basedOn: baseStyleId,
    fontFamily: base?.preview.fontFamily ?? "",
    fontSizePt: base?.preview.fontSizePt == null ? "" : String(base.preview.fontSizePt),
    bold: base?.preview.bold ? "on" : "off",
    italic: base?.preview.italic ? "on" : "off",
    color: base?.preview.color ? `#${base.preview.color.replace(/^#/, "")}` : "",
  };
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-8 min-w-0 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent";

export function ParagraphStyleManager({
  open,
  onClose,
  onDirty,
}: {
  open: boolean;
  onClose: () => void;
  onDirty: () => void;
}) {
  const editor = useDocxEditor();
  const style = useParagraphStyle();
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingStyleId, setEditingStyleId] = useState("");
  const [draft, setDraft] = useState<ParagraphStyleDraft>(EMPTY_DRAFT);
  const [applyAfterCreate, setApplyAfterCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const defaultStyleId = useMemo(
    () =>
      style.options.find((option) => option.styleId.toLowerCase() === "normal")?.styleId ??
      style.options[0]?.styleId ??
      "",
    [style.options],
  );

  useEffect(() => {
    if (!open) return;
    setMode("create");
    setEditingStyleId("");
    setDraft(draftForNewStyle(style.value ?? defaultStyleId, style.options));
    setError("");
  }, [open, defaultStyleId, style.options, style.value]);

  useEffect(() => {
    if (!open || mode !== "edit" || !editingStyleId || !editor) return;
    let cancelled = false;
    void editor.save().then((arrayBuffer) => {
      if (cancelled) return;
      const bytes = new Uint8Array(arrayBuffer);
      const stored = readParagraphStyleDraft(bytes, editingStyleId);
      const option = style.options.find((item) => item.styleId === editingStyleId);
      setDraft({
        ...EMPTY_DRAFT,
        ...stored,
        name: stored.name ?? option?.name ?? "",
        basedOn: stored.basedOn ?? defaultStyleId,
        fontFamily: stored.fontFamily ?? "",
        fontSizePt: stored.fontSizePt ?? "",
        color: stored.color ?? "",
      });
      setError("");
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "读取样式失败");
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, editingStyleId, editor, style.options, defaultStyleId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const setField = <K extends keyof ParagraphStyleDraft>(key: K, value: ParagraphStyleDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const changeMode = (nextMode: "create" | "edit") => {
    setMode(nextMode);
    setEditingStyleId(nextMode === "edit" ? style.options[0]?.styleId ?? "" : "");
    if (nextMode === "create") setDraft(draftForNewStyle(style.value ?? defaultStyleId, style.options));
  };

  const saveStyle = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) {
      setError("文档编辑器尚未就绪");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const currentBytes = new Uint8Array(await editor.save());
      const selection = editor.query({ type: "selection" });
      const result = writeParagraphStyle(currentBytes, draft, mode === "edit" ? editingStyleId : null);
      editor.load(result.bytes);

      if (mode === "create" && applyAfterCreate && selection && "paraId" in selection.from && "paraId" in selection.to) {
        const restored = editor.exec({
          type: "setSelection",
          range: { from: selection.from, to: selection.to },
        });
        if (restored.ok) editor.exec({ type: "setParagraphStyle", styleId: result.styleId });
      }

      onDirty();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存样式失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <button
        aria-label="关闭样式编辑"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
        type="button"
      />
      <form
        aria-label={mode === "create" ? "新建段落样式" : "编辑段落样式"}
        aria-modal="true"
        className="anim-pop relative flex max-h-full w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        onSubmit={saveStyle}
        role="dialog"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold text-ink">段落样式</h2>
          <div className="mt-3 inline-flex rounded-lg bg-surface-muted p-1">
            <button
              className={`rounded-md px-3 py-1 text-[12px] ${mode === "create" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"}`}
              onClick={() => changeMode("create")}
              type="button"
            >新建</button>
            <button
              className={`rounded-md px-3 py-1 text-[12px] ${mode === "edit" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"}`}
              onClick={() => changeMode("edit")}
              type="button"
            >编辑已有样式</button>
          </div>
        </div>

        <div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {mode === "edit" && (
            <FormField label="选择样式">
              <select className={inputClass} value={editingStyleId} onChange={(event) => setEditingStyleId(event.target.value)}>
                {style.options.map((option) => (
                  <option key={option.styleId} value={option.styleId}>
                    {getDisplayName(option.styleId, option.name)}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="样式名称">
            <input className={inputClass} maxLength={128} value={draft.name} onChange={(event) => setField("name", event.target.value)} />
          </FormField>
          <FormField label="基于样式">
            <select className={inputClass} value={draft.basedOn} onChange={(event) => setField("basedOn", event.target.value)}>
              <option value="">不基于其他样式</option>
              {style.options.filter((option) => option.styleId !== (mode === "edit" ? editingStyleId : "")).map((option) => (
                <option key={option.styleId} value={option.styleId}>
                  {getDisplayName(option.styleId, option.name)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="字体">
            <input className={inputClass} value={draft.fontFamily} onChange={(event) => setField("fontFamily", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <FormField label="字号（磅）">
            <input className={inputClass} min="0.5" max="1638" step="0.5" type="number" value={draft.fontSizePt} onChange={(event) => setField("fontSizePt", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <FormField label="文字颜色">
            <input className={inputClass} value={draft.color} onChange={(event) => setField("color", event.target.value)} placeholder="继承基础样式，例如 #222222" />
          </FormField>
          <FormField label="段落对齐">
            <select className={inputClass} value={draft.alignment} onChange={(event) => setField("alignment", event.target.value as ParagraphStyleDraft["alignment"])}>
              <option value="">继承基础样式</option>
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
              <option value="both">两端对齐</option>
            </select>
          </FormField>
          <FormField label="段前（磅）">
            <input className={inputClass} step="0.5" type="number" value={draft.spaceBeforePt} onChange={(event) => setField("spaceBeforePt", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <FormField label="段后（磅）">
            <input className={inputClass} step="0.5" type="number" value={draft.spaceAfterPt} onChange={(event) => setField("spaceAfterPt", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <FormField label="左缩进（磅）">
            <input className={inputClass} step="0.5" type="number" value={draft.indentLeftPt} onChange={(event) => setField("indentLeftPt", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <FormField label="首行缩进（磅）">
            <input className={inputClass} step="0.5" type="number" value={draft.firstLineIndentPt} onChange={(event) => setField("firstLineIndentPt", event.target.value)} placeholder="继承基础样式" />
          </FormField>
          <div className="flex items-end gap-4 pb-1 sm:col-span-2">
            {(["bold", "italic"] as const).map((key) => (
              <label className="flex items-center gap-1.5 text-[12px] text-ink-muted" key={key}>
                <span>{key === "bold" ? "粗体" : "斜体"}</span>
                <select className={`${inputClass} h-7`} value={draft[key]} onChange={(event) => setField(key, event.target.value as ParagraphStyleDraft[typeof key])}>
                  <option value="inherit">继承</option>
                  <option value="on">开启</option>
                  <option value="off">关闭</option>
                </select>
              </label>
            ))}
            {mode === "create" && (
              <label className="ml-auto flex items-center gap-2 text-[12px] text-ink-muted">
                <input checked={applyAfterCreate} onChange={(event) => setApplyAfterCreate(event.target.checked)} type="checkbox" />
                创建后应用到当前段落
              </label>
            )}
          </div>
        </div>

        {error && <p className="mx-5 mb-2 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button className="rounded-lg px-3 py-1.5 text-[12px] text-ink-muted hover:bg-surface-muted" disabled={busy} onClick={onClose} type="button">取消</button>
          <button className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-text hover:bg-accent-hover disabled:opacity-50" disabled={busy || !editor} type="submit">
            {busy ? "保存中…" : mode === "create" ? "新建样式" : "保存修改"}
          </button>
        </div>
      </form>
    </div>
  );
}
