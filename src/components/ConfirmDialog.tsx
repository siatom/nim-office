import { useEffect, useRef } from "react";
import clsx from "clsx";

export interface ConfirmAction {
  label: string;
  tone?: "default" | "danger" | "primary";
  onSelect: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  actions,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  actions: ConfirmAction[];
  onCancel: () => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="anim-fade absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="anim-pop relative w-[min(420px,calc(100vw-48px))] rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            取消
          </button>
          {actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === actions.length - 1 ? primaryRef : undefined}
              type="button"
              onClick={action.onSelect}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                action.tone === "danger"
                  ? "bg-danger text-white hover:brightness-110"
                  : action.tone === "primary"
                    ? "bg-accent text-accent-text hover:bg-accent-hover"
                    : "bg-surface-muted text-ink hover:bg-line",
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
