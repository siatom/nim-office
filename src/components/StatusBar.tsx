import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  CircleDot,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
} from "lucide-react";
import type { DocumentKind } from "../lib/ipc";
import { KIND_LABEL, formatBytes } from "../lib/format";
import { ZOOM_STEPS, type ZoomDisplayMode } from "../features/docx/engine";

const ZOOM_MENU_WIDTH = 148;
const ZOOM_MENU_GAP = 10;

/** Descending, so the menu reads like Word's: the largest scale on top. */
const ZOOM_PRESETS = [...ZOOM_STEPS].reverse();

/**
 * Word keeps the zoom ladder in the status bar rather than the ribbon. This is
 * that control: the readout doubles as the menu trigger, so the current value
 * and the presets stay in one place instead of splitting across two corners.
 */
function ZoomControl({
  zoom,
  zoomMode,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onZoomFit,
  onZoomFitPage,
}: {
  zoom: number;
  zoomMode: ZoomDisplayMode;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (percent: number) => void;
  onZoomFit: () => void;
  onZoomFitPage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ right: 0, bottom: 0 });
  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const percent = Math.round(zoom * 100);
  const zoomLabel =
    zoomMode === "page-width" ? "页宽" : zoomMode === "page" ? "整页" : `${percent}%`;

  const toggle = () => {
    if (!open && groupRef.current) {
      // Anchored to the whole −  100%  + group, so the panel lines up with the
      // right edge of the bar rather than with the readout inside it. The bar is
      // the last row of the window, so the panel opens upwards.
      const rect = groupRef.current.getBoundingClientRect();
      setAnchor({
        right: Math.max(ZOOM_MENU_GAP, window.innerWidth - rect.right),
        bottom: window.innerHeight - rect.top + ZOOM_MENU_GAP,
      });
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-zoom-menu]")) return;
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
    <div ref={groupRef} className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onZoomOut}
        title="缩小"
        aria-label="缩小"
        className="grid size-5 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
      >
        <Minus size={12} strokeWidth={2.4} />
      </button>

      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title="缩放级别"
        aria-label={`缩放级别 ${zoomLabel}，${percent}%`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          "h-5 min-w-[46px] rounded px-1.5 text-[11px] tabular-nums transition-colors",
          open
            ? "bg-surface-raised text-ink"
            : "text-ink-muted hover:bg-surface-raised hover:text-ink",
        )}
      >
        {zoomLabel}
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        title="放大"
        aria-label="放大"
        className="grid size-5 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
      >
        <Plus size={12} strokeWidth={2.4} />
      </button>

      {open && (
        <div
          data-zoom-menu
          role="menu"
          aria-label="缩放级别"
          style={{ right: anchor.right, bottom: anchor.bottom, width: ZOOM_MENU_WIDTH }}
          className="anim-pop fixed z-50 rounded-xl border border-line bg-surface-raised p-1 shadow-card dark:border-line-strong"
        >
          {ZOOM_PRESETS.map((preset) => {
            const selected = zoomMode === "fixed" && preset === percent;
            return (
              <button
                key={preset}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onZoomTo(preset);
                  setOpen(false);
                }}
                className={clsx(
                  "flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] tabular-nums transition-colors",
                  selected ? "text-accent" : "text-ink hover:bg-surface-muted",
                )}
              >
                <span>{preset}%</span>
                {selected && <Check size={12} strokeWidth={2.6} />}
              </button>
            );
          })}

          <div className="my-1 h-px bg-line" />

          <button
            type="button"
            role="menuitemradio"
            aria-checked={zoomMode === "page-width"}
            onClick={() => {
              onZoomFit();
              setOpen(false);
            }}
            className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] text-ink transition-colors hover:bg-surface-muted"
          >
            <span>页宽</span>
            {zoomMode === "page-width" && (
              <Check size={12} strokeWidth={2.6} className="ml-auto" />
            )}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={zoomMode === "page"}
            onClick={() => {
              onZoomFitPage();
              setOpen(false);
            }}
            className="flex h-7 w-full items-center rounded-md px-2 text-[12px] text-ink transition-colors hover:bg-surface-muted"
          >
            <span>整页</span>
            {zoomMode === "page" && (
              <Check size={12} strokeWidth={2.6} className="ml-auto" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function StatusBar({
  name,
  kind,
  size,
  dirty,
  saving,
  zoom,
  zoomMode,
  hint,
  persisted,
  fullscreen,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onZoomFit,
  onZoomFitPage,
  onToggleFullscreen,
}: {
  name: string | null;
  kind: DocumentKind | null;
  size: number;
  dirty: boolean;
  saving: boolean;
  zoom: number;
  zoomMode: ZoomDisplayMode;
  hint?: string;
  persisted: boolean;
  fullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (percent: number) => void;
  onZoomFit: () => void;
  onZoomFitPage: () => void;
  onToggleFullscreen: () => void;
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
        {/* Zoom describes a document, so the control only exists beside one. */}
        {name && (
          <>
            <span className="h-3 w-px bg-line" />
            <ZoomControl
              zoom={zoom}
              zoomMode={zoomMode}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onZoomTo={onZoomTo}
              onZoomFit={onZoomFit}
              onZoomFitPage={onZoomFitPage}
            />
          </>
        )}
        {name && <span className="h-3 w-px bg-line" />}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? "退出全屏" : "进入全屏"}
          aria-label={fullscreen ? "退出全屏" : "进入全屏"}
          className="grid size-5 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          {fullscreen ? (
            <Minimize2 size={12} strokeWidth={2} />
          ) : (
            <Maximize2 size={12} strokeWidth={2} />
          )}
        </button>
      </div>
    </footer>
  );
}
