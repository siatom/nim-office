import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function SettingsDialog({
  open,
  autoSave,
  onAutoSaveChange,
  onClose,
}: {
  open: boolean;
  autoSave: boolean;
  onAutoSaveChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="关闭设置"
        className="anim-fade absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="anim-pop relative w-[min(440px,calc(100vw-48px))] rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <header className="flex items-start justify-between">
          <div>
            <h2 id="settings-title" className="text-[14px] font-semibold text-ink">设置</h2>
            <p className="mt-1 text-[12px] text-ink-muted">管理文档编辑偏好</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭设置"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X size={15} />
          </button>
        </header>

        <div className="mt-5 rounded-xl border border-line bg-surface-muted p-3.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="auto-save-toggle" className="text-[12.5px] font-medium text-ink">
                自动保存
              </label>
              <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-ink-muted">
                停止编辑 1.5 秒后保存已命名的文档。新建文档首次保存时仍需选择位置。
              </p>
            </div>
            <button
              id="auto-save-toggle"
              type="button"
              role="switch"
              aria-checked={autoSave}
              onClick={() => onAutoSaveChange(!autoSave)}
              className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${autoSave ? "bg-accent" : "bg-line-strong"}`}
            >
              <span
                className={`absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-transform ${autoSave ? "translate-x-[19px]" : "translate-x-[3px]"}`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
