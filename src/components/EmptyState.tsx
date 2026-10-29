import {
  FilePlus2,
  FileText,
  FileType2,
  FolderOpen,
  Presentation,
  Table2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { RecentEntry } from "../lib/ipc";
import { KIND_COLOR, formatRelativeTime } from "../lib/format";

const ICONS = {
  docx: FileText,
  xlsx: Table2,
  pptx: Presentation,
  pdf: FileType2,
  unknown: FileText,
};

function dirName(path: string): string {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index > 0 ? path.slice(0, index) : path;
}

function RecentRow({
  entry,
  onOpen,
  onRemove,
}: {
  entry: RecentEntry;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const Icon = ICONS[entry.kind];

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={onOpen}
        title={entry.path}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-3 text-left transition-colors hover:bg-surface-muted"
      >
        <Icon size={14} className={clsx("shrink-0", KIND_COLOR[entry.kind])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">
            {entry.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">
            {dirName(entry.path)}
          </span>
        </span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-subtle transition-opacity group-hover:opacity-0">
          {formatRelativeTime(entry.openedAt)}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`从最近打开中移除 ${entry.name}`}
        title="从最近打开中移除"
        className="absolute right-2 grid size-6 place-items-center rounded-md text-ink-subtle opacity-0 transition-[opacity,color,background-color] hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function EmptyState({
  recent,
  onOpen,
  onNew,
  onOpenRecent,
  onRemoveRecent,
}: {
  recent: RecentEntry[];
  onOpen: () => void;
  onNew: () => void;
  onOpenRecent: (entry: RecentEntry) => void;
  onRemoveRecent: (entry: RecentEntry) => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-8 py-12">
      <div className="anim-rise mx-auto flex w-full max-w-[520px] flex-col items-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-sm">
          <FilePlus2 size={22} className="text-ink-subtle" strokeWidth={1.6} />
        </div>

        <h2 className="mt-5 text-[15px] font-medium tracking-tight text-ink">
          开始你的工作
        </h2>
        <p className="mt-1.5 max-w-[320px] text-center text-[12.5px] leading-relaxed text-ink-muted">
          {recent.length > 0
            ? "从最近打开的文档继续，或选择一个新的 Word 文档"
            : "打开一个 Word 文档，或新建空白文档开始"}
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

        {recent.length > 0 && (
          <section className="mt-10 w-full">
            <div className="flex items-baseline justify-between px-0.5 pb-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-subtle">
                最近打开
              </span>
              <span className="text-[10.5px] tabular-nums text-ink-subtle">
                {recent.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="divide-y divide-line">
                {recent.map((entry) => (
                  <RecentRow
                    key={entry.path}
                    entry={entry}
                    onOpen={() => onOpenRecent(entry)}
                    onRemove={() => onRemoveRecent(entry)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-[11px] text-ink-subtle">
          当前版本支持 .docx · Excel / PowerPoint / PDF 正在开发中
        </p>
      </div>
    </div>
  );
}
