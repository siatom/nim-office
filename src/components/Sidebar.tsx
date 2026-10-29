import {
  FilePlus2,
  FileText,
  FileType2,
  FolderOpen,
  Presentation,
  Save,
  Table2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { RecentEntry } from "../lib/ipc";
import type { ThemeMode } from "../hooks/useTheme";
import { KIND_COLOR } from "../lib/format";
import { AppearanceMenu } from "./AppearanceMenu";

const ICONS = {
  docx: FileText,
  xlsx: Table2,
  pptx: Presentation,
  pdf: FileType2,
  unknown: FileText,
};

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  primary,
}: {
  icon: typeof FilePlus2;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors",
        primary
          ? "bg-accent text-accent-text hover:bg-accent-hover"
          : "text-ink-muted hover:bg-surface hover:text-ink",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span className="flex-1 truncate text-[12.5px] font-medium">{label}</span>
      {hint && (
        <span
          className={clsx(
            "text-[10.5px] tabular-nums",
            primary ? "text-accent-text/60" : "text-ink-subtle opacity-0 group-hover:opacity-100",
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  recent,
  hasActive,
  mode,
  accent,
  onNew,
  onOpen,
  onSave,
  onOpenRecent,
  onRemoveRecent,
  onModeChange,
  onAccentChange,
}: {
  recent: RecentEntry[];
  hasActive: boolean;
  mode: ThemeMode;
  accent: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onOpenRecent: (entry: RecentEntry) => void;
  onRemoveRecent: (entry: RecentEntry) => void;
  onModeChange: (mode: ThemeMode) => void;
  onAccentChange: (color: string) => void;
}) {
  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-line bg-surface-muted">
      <div className="space-y-0.5 p-2">
        <ActionButton icon={FilePlus2} label="新建文档" hint="Ctrl N" onClick={onNew} primary />
        <ActionButton icon={FolderOpen} label="打开文件" hint="Ctrl O" onClick={onOpen} />
        <ActionButton
          icon={Save}
          label="保存"
          hint="Ctrl S"
          onClick={onSave}
          disabled={!hasActive}
        />
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-subtle">
            最近
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {recent.length === 0 ? (
            <p className="px-2 py-3 text-[11.5px] leading-relaxed text-ink-subtle">
              还没有最近打开的文件
            </p>
          ) : (
            recent.map((entry) => {
              const Icon = ICONS[entry.kind];
              return (
                <div key={entry.path} className="group relative">
                  <button
                    type="button"
                    onClick={() => onOpenRecent(entry)}
                    title={entry.path}
                    className="flex w-full items-center gap-2 rounded-lg py-[6px] pl-2.5 pr-6 text-left transition-colors hover:bg-surface"
                  >
                    <Icon size={13} className={clsx("shrink-0", KIND_COLOR[entry.kind])} />
                    <span className="truncate text-[12px] text-ink-muted group-hover:text-ink">
                      {entry.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRecent(entry)}
                    aria-label={`移除 ${entry.name}`}
                    className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-subtle opacity-0 transition-opacity hover:bg-line hover:text-ink group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-line p-2">
        <AppearanceMenu
          mode={mode}
          onModeChange={onModeChange}
          accent={accent}
          onAccentChange={onAccentChange}
        />
      </div>
    </aside>
  );
}
