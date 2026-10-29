import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import clsx from "clsx";
import { ACCENT_PRESETS, readableInk } from "../lib/accents";
import type { ThemeMode } from "../hooks/useTheme";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随", icon: Monitor },
];

const CUSTOM_GRADIENT =
  "conic-gradient(from 210deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)";

export function AppearanceMenu({
  mode,
  onModeChange,
  accent,
  onAccentChange,
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  accent: string;
  onAccentChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] transition-colors",
          open ? "bg-surface text-ink" : "text-ink-muted hover:bg-surface hover:text-ink",
        )}
      >
        <Palette size={14} className="shrink-0" />
        <span className="flex-1 text-left text-[12.5px] font-medium">外观</span>
        <span
          className="size-3 rounded-full"
          style={{
            backgroundColor: "var(--accent)",
            boxShadow: "inset 0 0 0 1px rgb(125 125 135 / 0.35)",
          }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="外观设置"
          className="anim-pop absolute bottom-[calc(100%+8px)] left-0 z-40 w-[264px] rounded-xl border border-line bg-surface-raised p-2.5 shadow-card"
        >
          <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-muted p-0.5">
            {MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-[6px] py-1 text-[11.5px] font-medium transition-colors",
                  mode === value
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          <p className="pb-2 pt-3 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-subtle">
            主题色
          </p>

          <div className="flex items-center justify-between">
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.color === accent;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.name}
                  aria-label={preset.name}
                  aria-pressed={selected}
                  onClick={() => onAccentChange(preset.color)}
                  className={clsx(
                    "grid size-[22px] place-items-center rounded-full transition-transform",
                    selected ? "scale-105" : "hover:scale-110 active:scale-95",
                  )}
                  style={{
                    backgroundColor: preset.color,
                    boxShadow: selected
                      ? `0 0 0 2px var(--surface-raised), 0 0 0 4px ${preset.color}`
                      : "inset 0 0 0 1px rgb(125 125 135 / 0.35)",
                  }}
                >
                  {selected && (
                    <Check
                      size={11}
                      strokeWidth={3}
                      style={{ color: readableInk(preset.color) }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <label className="-mx-1 mt-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-muted">
            <span
              className="size-6 shrink-0 rounded-full"
              style={{
                background: CUSTOM_GRADIENT,
                boxShadow: "inset 0 0 0 1px rgb(125 125 135 / 0.35)",
              }}
            />
            <span className="flex-1 text-[12px] font-medium text-ink">自定义</span>
            <span className="text-[11px] tabular-nums text-ink-subtle">
              {accent.toUpperCase()}
            </span>
            <input
              type="color"
              value={accent}
              onChange={(event) => onAccentChange(event.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      )}
    </div>
  );
}
