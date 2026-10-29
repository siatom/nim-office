import { FileDown } from "lucide-react";

export function DropOverlay() {
  return (
    <div className="anim-fade pointer-events-none absolute inset-0 z-40 grid place-items-center bg-bg/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/40 bg-surface/80 px-10 py-8 shadow-card">
        <FileDown size={24} className="text-accent" strokeWidth={1.6} />
        <p className="text-[13px] font-medium text-ink">松开以打开文件</p>
        <p className="text-[11.5px] text-ink-muted">支持 .docx</p>
      </div>
    </div>
  );
}
