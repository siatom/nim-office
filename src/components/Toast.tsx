import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";

export type ToastKind = "error" | "success" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICONS[item.kind];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.kind === "error" ? 6000 : 3200);
    return () => window.clearTimeout(timer);
  }, [item, onDismiss]);

  return (
    <div
      role="status"
      className={clsx(
        "anim-pop pointer-events-auto flex w-[min(360px,calc(100vw-32px))] items-start gap-2.5",
        "rounded-xl border border-line bg-surface-raised px-3.5 py-3 shadow-card",
      )}
    >
      <Icon
        size={16}
        className={clsx(
          "mt-0.5 shrink-0",
          item.kind === "error" && "text-danger",
          item.kind === "success" && "text-emerald-500",
          item.kind === "info" && "text-accent",
        )}
      />
      <p className="flex-1 text-[12.5px] leading-relaxed text-ink">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="-mr-1 rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
        aria-label="关闭提示"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
