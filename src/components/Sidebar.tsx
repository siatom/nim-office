import {
  FilePlus2,
  FolderOpen,
  Moon,
  Save,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { AccentMenu } from "./AccentMenu";

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  primary,
}: {
  icon: LucideIcon;
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
        "group flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-[background-color,color,transform] duration-150 active:scale-[0.99]",
        primary
          ? "bg-accent-soft text-accent hover:bg-accent-soft"
          : "text-ink-muted hover:bg-surface hover:text-ink",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon size={16} strokeWidth={1.8} className="shrink-0" />
      <span className="flex-1 truncate text-[12.5px] font-medium">{label}</span>
      {hint && (
        <span
          className={clsx(
            "text-[10.5px] tabular-nums",
            primary ? "text-accent/65" : "text-ink-subtle opacity-0 group-hover:opacity-100",
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        "grid size-9 shrink-0 place-items-center rounded-lg transition-[background-color,color,transform] duration-150 active:scale-95",
        primary
          ? "bg-accent-soft text-accent hover:bg-accent-soft"
          : "text-ink-muted hover:bg-surface hover:text-ink",
        disabled && "cursor-not-allowed opacity-35",
      )}
    >
      <Icon size={16} strokeWidth={1.8} />
    </button>
  );
}

/**
 * Document actions plus the appearance/settings cluster pinned to the bottom
 * left. Collapsing swaps the labelled panel for an icon rail that keeps every
 * action one click away.
 */
export function Sidebar({
  collapsed,
  hasActive,
  isDark,
  accent,
  onNew,
  onOpen,
  onSave,
  onToggleMode,
  onAccentChange,
  onOpenSettings,
}: {
  collapsed: boolean;
  hasActive: boolean;
  isDark: boolean;
  accent: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onToggleMode: () => void;
  onAccentChange: (color: string) => void;
  onOpenSettings: () => void;
}) {
  const modeLabel = isDark ? "切换到浅色" : "切换到深色";
  const ModeIcon = isDark ? Sun : Moon;

  if (collapsed) {
    return (
      <aside aria-label="文档操作" className="flex h-full w-[56px] flex-col items-center gap-1 px-2 py-2">
        <RailButton icon={FilePlus2} label="新建文档" onClick={onNew} primary />
        <RailButton icon={FolderOpen} label="打开文件" onClick={onOpen} />
        <RailButton icon={Save} label="保存" onClick={onSave} disabled={!hasActive} />

        <div className="mt-auto flex flex-col items-center gap-1 border-t border-line pt-2">
          <RailButton icon={ModeIcon} label={modeLabel} onClick={onToggleMode} />
          <AccentMenu accent={accent} onSelect={onAccentChange} rail />
          <RailButton icon={Settings} label="设置" onClick={onOpenSettings} />
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="文档操作" className="flex h-full w-[224px] flex-col px-2 py-2">
      <div className="space-y-1">
        <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold tracking-[0.12em] text-ink-subtle">
          文档
        </p>
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

      <div className="mt-auto flex items-center justify-between gap-1 border-t border-line pt-2">
        <RailButton icon={ModeIcon} label={modeLabel} onClick={onToggleMode} />
        <AccentMenu accent={accent} onSelect={onAccentChange} />
        <RailButton icon={Settings} label="设置" onClick={onOpenSettings} />
      </div>
    </aside>
  );
}
