import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import clsx from "clsx";
import { ACCENT_PRESETS, readableInk } from "../lib/accents";

const PANEL_WIDTH = 240;
const PANEL_GAP = 8;
const CUSTOM_GRADIENT =
  "conic-gradient(from 210deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)";

/**
 * Accent swatch picker. The panel is anchored to the trigger with fixed
 * positioning so it can escape the sidebar's width transition and open to the
 * right of the collapsed icon rail.
 */
export function AccentMenu({
  accent,
  onSelect,
  rail,
}: {
  accent: string;
  onSelect: (color: string) => void;
  rail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ left: 0, bottom: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // In the icon rail the panel opens beside the rail instead of on top of
      // it, so the trigger stays visible while the swatches are picked.
      const preferred = rail ? rect.right + PANEL_GAP : rect.left;
      setAnchor({
        left: Math.max(
          PANEL_GAP,
          Math.min(preferred, window.innerWidth - PANEL_WIDTH - PANEL_GAP),
        ),
        bottom: window.innerHeight - rect.top + PANEL_GAP,
      });
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-accent-panel]")) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="主题色"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="主题色"
        className={clsx(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
          open ? "bg-surface text-ink" : "text-ink-muted hover:bg-surface hover:text-ink",
        )}
      >
        <Palette size={15} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          data-accent-panel
          role="dialog"
          aria-label="主题色"
          style={{ left: anchor.left, bottom: anchor.bottom, width: PANEL_WIDTH }}
          className="anim-pop fixed z-50 rounded-xl border border-line bg-surface-raised p-3 shadow-card dark:border-line-strong"
        >
          <p className="pb-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-subtle">
            主题色
          </p>

          <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-2.5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.color === accent;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.name}
                  aria-label={preset.name}
                  aria-pressed={selected}
                  onClick={() => onSelect(preset.color)}
                  className={clsx(
                    "grid size-7 place-items-center rounded-full transition-transform",
                    selected ? "scale-100" : "hover:scale-110 active:scale-95",
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
                      size={12}
                      strokeWidth={3}
                      style={{ color: readableInk(preset.color) }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <label className="-mx-1 mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-muted">
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
              onChange={(event) => onSelect(event.target.value)}
              className="sr-only"
            />
          </label>
        </div>
      )}
    </>
  );
}
