import clsx from "clsx";
import { CircleCheck, CircleDot } from "lucide-react";
import type { DocumentKind } from "../lib/ipc";
import { KIND_LABEL, formatBytes } from "../lib/format";

export function StatusBar({
  name,
  kind,
  size,
  dirty,
  saving,
  zoom,
  hint,
  persisted,
}: {
  name: string | null;
  kind: DocumentKind | null;
  size: number;
  dirty: boolean;
  saving: boolean;
  zoom: number;
  hint?: string;
  persisted: boolean;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-line bg-surface-muted px-3 text-[11px] text-ink-muted">
      <div className="flex min-w-0 items-center gap-3">
        {name ? (
          <>
            <span className="truncate">{name}</span>
            <span
              className={clsx(
                "flex items-center gap-1",
                dirty || !persisted ? "text-accent" : "text-ink-subtle",
              )}
            >
              {saving ? (
                <>
                  <CircleDot size={10} className="animate-pulse" />
                  保存中
                </>
              ) : dirty || !persisted ? (
                <>
                  <CircleDot size={10} />
                  未保存
                </>
              ) : (
                <>
                  <CircleCheck size={10} />
                  已保存
                </>
              )}
            </span>
          </>
        ) : (
          <span>{hint ?? "就绪"}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {kind && <span>{KIND_LABEL[kind]}</span>}
        {size > 0 && <span>{formatBytes(size)}</span>}
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}
