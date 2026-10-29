import { FilePlus2, FolderOpen } from "lucide-react";

export function EmptyState({
  onOpen,
  onNew,
}: {
  onOpen: () => void;
  onNew: () => void;
}) {
  return (
    <div className="grid h-full place-items-center px-8">
      <div className="anim-rise flex flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-sm">
          <FilePlus2 size={22} className="text-ink-subtle" strokeWidth={1.6} />
        </div>

        <h2 className="mt-5 text-[15px] font-medium tracking-tight text-ink">
          开始你的工作
        </h2>
        <p className="mt-1.5 max-w-[300px] text-[12.5px] leading-relaxed text-ink-muted">
          从左侧最近文件中选择，或打开一个 Word 文档
        </p>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent-hover"
          >
            <FolderOpen size={13} />
            打开文件
          </button>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-muted"
          >
            新建文档
          </button>
        </div>

        <p className="mt-8 text-[11px] text-ink-subtle">
          当前版本支持 .docx · Excel / PowerPoint / PDF 正在开发中
        </p>
      </div>
    </div>
  );
}
