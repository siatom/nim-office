import { useEffect, useState } from "react";
import { usePageSetup } from "@docx-editor.dev/react";
import { X } from "lucide-react";

const TWIPS_PER_CM = 1440 / 2.54;
const FIELDS = [
  ["marginTopTwips", "上边距"],
  ["marginBottomTwips", "下边距"],
  ["marginLeftTwips", "左边距"],
  ["marginRightTwips", "右边距"],
] as const;
type MarginKey = (typeof FIELDS)[number][0];

export default function PageMarginsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pageSetup, isEnabled, apply } = usePageSetup();
  const [values, setValues] = useState<Record<MarginKey, string>>({ marginTopTwips: "", marginBottomTwips: "", marginLeftTwips: "", marginRightTwips: "" });
  useEffect(() => {
    if (!open || !pageSetup) return;
    setValues({
      marginTopTwips: (pageSetup.marginsTwips.top / TWIPS_PER_CM).toFixed(2),
      marginBottomTwips: (pageSetup.marginsTwips.bottom / TWIPS_PER_CM).toFixed(2),
      marginLeftTwips: (pageSetup.marginsTwips.left / TWIPS_PER_CM).toFixed(2),
      marginRightTwips: (pageSetup.marginsTwips.right / TWIPS_PER_CM).toFixed(2),
    });
  }, [open, pageSetup]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  const submit = () => {
    const update = Object.fromEntries(FIELDS.map(([key]) => [key, Math.round(Number(values[key]) * TWIPS_PER_CM)]));
    if (Object.values(update).some((value) => !Number.isFinite(value) || value < 0)) return;
    if (apply(update)) onClose();
  };
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 p-5 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-modal="true" aria-labelledby="page-margins-title" role="dialog" className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[0_24px_80px_-20px_rgba(15,23,42,.35)]">
        <header className="flex items-start justify-between border-b border-border px-6 py-5">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-accent">页面布局</p><h2 id="page-margins-title" className="mt-1 text-lg font-semibold text-text">页边距</h2><p className="mt-1 text-xs text-text-muted">设置正文与纸张边缘之间的距离</p></div>
          <button aria-label="关闭" className="rounded-lg p-2 text-text-muted transition hover:bg-surface-muted hover:text-text" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="grid grid-cols-2 gap-3 p-6">
          {FIELDS.map(([key, label]) => <label key={key} className="rounded-xl border border-border bg-surface px-3.5 py-3 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/10"><span className="text-xs font-medium text-text-muted">{label}</span><span className="mt-2 flex items-center gap-2"><input aria-label={label} className="w-full bg-transparent text-[15px] font-medium tabular-nums text-text outline-none" type="number" min="0" max="20" step="0.1" value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /><span className="text-xs text-text-subtle">cm</span></span></label>)}
        </div>
        <footer className="flex items-center justify-between border-t border-border bg-surface-muted/60 px-6 py-4"><span className="text-[11px] text-text-subtle">应用于当前节</span><div className="flex gap-2"><button className="rounded-lg px-4 py-2 text-xs font-medium text-text-muted transition hover:bg-surface hover:text-text" onClick={onClose}>取消</button><button disabled={!isEnabled} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-text shadow-sm transition hover:bg-accent-hover disabled:opacity-50" onClick={submit}>应用</button></div></footer>
      </section>
    </div>
  );
}
