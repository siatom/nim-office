import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, PanelLeftClose, PanelLeftOpen, Square, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./Logo";
import { TabBar, type TabDescriptor } from "./TabBar";

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
      data-window-control
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "grid h-full w-[46px] place-items-center text-ink-muted transition-colors",
        danger
          ? "hover:bg-[#e81123] hover:text-white"
          : "hover:bg-line/70 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({
  tabs,
  activeId,
  sidebarOpen,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleSidebar,
  onShowWelcome,
}: {
  tabs: TabDescriptor[];
  activeId: string | null;
  sidebarOpen: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onToggleSidebar: () => void;
  onShowWelcome: () => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const dragStart = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );

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

  useEffect(() => {
    const dragWindow = getCurrentWindow();
    const onPointerMove = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start || event.pointerId !== start.pointerId) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy < 36) return;

      dragStart.current = null;
      void dragWindow.startDragging();
    };
    const stopDragging = (event: PointerEvent) => {
      if (dragStart.current?.pointerId === event.pointerId) {
        dragStart.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  return (
    <header
      onDoubleClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button")
        ) {
          return;
        }
        void win.toggleMaximize();
      }}
      onPointerDown={(event) => {
        if (
          event.button !== 0 ||
          (event.target instanceof Element &&
            event.target.closest("[data-window-control]"))
        ) {
          return;
        }
        dragStart.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        };
      }}
      className="flex h-9 shrink-0 select-none items-center border-b border-line bg-bg"
    >
      <div
        className={clsx(
          "flex shrink-0 items-center gap-2 pr-1",
          isMac ? "pl-20" : "pl-2",
        )}
      >
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          {sidebarOpen ? (
            <PanelLeftClose size={15} strokeWidth={1.8} />
          ) : (
            <PanelLeftOpen size={15} strokeWidth={1.8} />
          )}
        </button>
        <button
          type="button"
          onClick={onShowWelcome}
          aria-label="回到欢迎页"
          title="回到欢迎页"
          className="-ml-1 flex shrink-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-surface"
        >
          <Logo size={16} />
          <span className="text-[12px] font-medium tracking-tight text-ink">
            One Office
          </span>
        </button>
      </div>

      {tabs.length > 0 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1 pl-2">
          <TabBar
            tabs={tabs}
            activeId={activeId}
            onSelect={onSelectTab}
            onClose={onCloseTab}
            onNew={onNewTab}
          />
        </div>
      ) : (
        <div className="h-full flex-1" />
      )}

      {!isMac && (
        <div className="ml-2 flex h-full shrink-0 items-stretch">
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
