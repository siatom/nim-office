import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./Logo";

const isMac = navigator.userAgent.includes("Mac");

function WindowButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "grid h-9 w-[46px] place-items-center text-ink-muted transition-colors",
        danger
          ? "hover:bg-[#e81123] hover:text-white"
          : "hover:bg-line/70 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({ subtitle }: { subtitle?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setMaximized);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  const win = getCurrentWindow();

  return (
    <header
      data-tauri-drag-region
      className="flex h-9 shrink-0 select-none items-center bg-surface-muted"
    >
      <div
        data-tauri-drag-region
        className={clsx("flex items-center gap-2", isMac ? "pl-20" : "pl-3")}
      >
        <Logo size={16} />
        <span
          data-tauri-drag-region
          className="text-[12px] font-medium tracking-tight text-ink"
        >
          One Office
        </span>
        {subtitle && (
          <span data-tauri-drag-region className="truncate text-[11.5px] text-ink-subtle">
            {subtitle}
          </span>
        )}
      </div>

      <div data-tauri-drag-region className="h-full flex-1" />

      {!isMac && (
        <div className="flex h-full items-stretch">
          <WindowButton label="最小化" onClick={() => void win.minimize()}>
            <Minus size={14} />
          </WindowButton>
          <WindowButton
            label={maximized ? "还原" : "最大化"}
            onClick={() => void win.toggleMaximize()}
          >
            {maximized ? <Copy size={12} /> : <Square size={11.5} />}
          </WindowButton>
          <WindowButton label="关闭" danger onClick={() => void win.close()}>
            <X size={15} />
          </WindowButton>
        </div>
      )}
    </header>
  );
}
