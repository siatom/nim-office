import { FilePlus2, FolderOpen, Moon, Save, Settings, Sun } from "lucide-react";
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

function RailButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: typeof FilePlus2;
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
        "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
        primary
          ? "bg-accent text-accent-text hover:bg-accent-hover"
          : "text-ink-muted hover:bg-surface hover:text-ink",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      <Icon size={15} strokeWidth={1.8} />
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
      <aside className="flex h-full w-[52px] flex-col items-center gap-1 py-2">
        <RailButton icon={FilePlus2} label="新建文档" onClick={onNew} primary />
        <RailButton icon={FolderOpen} label="打开文件" onClick={onOpen} />
        <RailButton icon={Save} label="保存" onClick={onSave} disabled={!hasActive} />

        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
          <div className="mb-1 h-px w-7 bg-line" />
          <RailButton icon={ModeIcon} label={modeLabel} onClick={onToggleMode} />
          <AccentMenu accent={accent} onSelect={onAccentChange} rail />
          <RailButton icon={Settings} label="设置" onClick={onOpenSettings} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[212px] flex-col">
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

      <div className="mt-auto flex items-center gap-1 border-t border-line p-2">
        <RailButton icon={ModeIcon} label={modeLabel} onClick={onToggleMode} />
        <AccentMenu accent={accent} onSelect={onAccentChange} />
        <RailButton icon={Settings} label="设置" onClick={onOpenSettings} />
      </div>
    </aside>
  );
}
