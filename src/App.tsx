import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import clsx from "clsx";

import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import type { TabDescriptor } from "./components/TabBar";
import { StatusBar } from "./components/StatusBar";
import { EmptyState } from "./components/EmptyState";
import { DropOverlay } from "./components/DropOverlay";
import { ConfirmDialog, type ConfirmAction } from "./components/ConfirmDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToastStack, type ToastItem, type ToastKind } from "./components/Toast";
import { DocxLoadingState, DocxView } from "./features/docx/DocxView";
import type { DocxEngineHandle } from "./features/docx/engine";
import { useTheme } from "./hooks/useTheme";
import { useAccent } from "./hooks/useAccent";
import { base64ToBytes } from "./lib/base64";
import {
  describeDocument,
  listRecent,
  pushRecent,
  readDocument,
  removeRecent,
  writeDocument,
  type DocumentKind,
  type RecentEntry,
} from "./lib/ipc";
import { baseName, KIND_LABEL } from "./lib/format";

interface DocTab {
  id: string;
  path: string | null;
  name: string;
  kind: DocumentKind;
  /** Absent while the file is still being read off the native side. */
  data: Uint8Array | null;
  size: number;
  opening: boolean;
  openError: string | null;
  dirty: boolean;
  revision: number;
  saving: boolean;
}

const SUPPORTED: DocumentKind[] = ["docx"];
const SIDEBAR_KEY = "one-office.sidebar";
const AUTO_SAVE_KEY = "one-office.auto-save";
const AUTO_SAVE_DELAY = 1500;

function readAutoSavePreference(): boolean {
  return localStorage.getItem(AUTO_SAVE_KEY) === "enabled";
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "发生未知错误";
}

export default function App() {
  const { isDark, toggle: toggleMode } = useTheme();
  const { color: accent, select: selectAccent } = useAccent();

  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pending, setPending] = useState<
    { kind: "tab"; id: string } | { kind: "window" } | null
  >(null);
  const [dragging, setDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(readAutoSavePreference);
  // The welcome page is also reachable while documents stay open, so it needs
  // its own flag rather than being derived from an empty tab list.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) !== "collapsed",
  );

  const handles = useRef(new Map<string, DocxEngineHandle>());
  const saveOperations = useRef(new Map<string, Promise<boolean>>());
  const revisions = useRef(new Map<string, number>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null;
  const showWelcome = welcomeOpen || tabs.length === 0;
  // The status bar describes the document on screen, so it goes quiet while the
  // welcome page is in front of it.
  const statusTab = showWelcome ? null : activeTab;

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  const selectTab = useCallback((id: string) => {
    setActiveId(id);
    setWelcomeOpen(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "open" : "collapsed");
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_KEY, autoSave ? "enabled" : "disabled");
  }, [autoSave]);

  const patchTab = useCallback((id: string, patch: Partial<DocTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  useEffect(() => {
    listRecent()
      .then(setRecent)
      .catch((error) => pushToast("error", errorMessage(error)));
  }, [pushToast]);

  useEffect(() => {
    if (!activeId) return;
    setMounted((prev) => (prev.includes(activeId) ? prev : [...prev, activeId]));
  }, [activeId]);

  useEffect(() => {
    const handle = activeId ? handles.current.get(activeId) : undefined;
    setZoom(handle ? handle.getZoom() / 100 : 1);
  }, [activeId]);

  const openPaths = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        const existing = tabsRef.current.find((tab) => tab.path === path);
        if (existing) {
          setActiveId(existing.id);
          setWelcomeOpen(false);
          continue;
        }

        try {
          // `describeDocument` only stats the file. In particular, it does not
          // Base64-encode a large DOCX before React can paint the new tab.
          const summary = await describeDocument(path);
          if (!SUPPORTED.includes(summary.kind)) {
            pushToast("info", `${KIND_LABEL[summary.kind]}暂不支持编辑，将在后续版本中提供`);
            continue;
          }

          const id = crypto.randomUUID();
          const tab: DocTab = {
            id,
            path: summary.path,
            name: summary.name,
            kind: summary.kind,
            data: null,
            size: summary.size,
            opening: true,
            openError: null,
            dirty: false,
            revision: 0,
            saving: false,
          };
          setTabs((prev) => [...prev, tab]);
          setActiveId(id);
          setWelcomeOpen(false);
          // Let React commit the selected tab before the expensive payload
          // arrives. This keeps a 400 MB file from making "Open" feel inert.
          void readDocument(path)
            .then((payload) => {
              patchTab(id, {
                data: base64ToBytes(payload.data),
                opening: false,
              });
            })
            .catch((error) => {
              const message = errorMessage(error);
              patchTab(id, { opening: false, openError: message });
              pushToast("error", message);
            });
          void pushRecent(path).then(setRecent).catch(() => undefined);
        } catch (error) {
          pushToast("error", errorMessage(error));
        }
      }
    },
    [patchTab, pushToast],
  );

  const handleOpen = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        title: "打开文档",
        filters: [
          { name: "Word 文档", extensions: ["docx"] },
          { name: "所有文件", extensions: ["*"] },
        ],
      });
      if (!selected) return;
      await openPaths(Array.isArray(selected) ? selected : [selected]);
    } catch (error) {
      pushToast("error", errorMessage(error));
    }
  }, [openPaths, pushToast]);

  const handleNew = useCallback(() => {
    const id = crypto.randomUUID();
    setTabs((prev) => [
      ...prev,
      {
        id,
        path: null,
        name: "无标题文档.docx",
        kind: "docx",
        data: new Uint8Array(),
        size: 0,
        opening: false,
        openError: null,
        dirty: false,
        revision: 0,
        saving: false,
      },
    ]);
    setActiveId(id);
    setWelcomeOpen(false);
  }, []);

  const saveTab = useCallback(
    (id: string, forceDialog = false): Promise<boolean> => {
      const inProgress = saveOperations.current.get(id);
      if (inProgress) {
        return inProgress.then((saved) => {
          if (!saved) return false;
          if (forceDialog) return saveTab(id, true);
          const current = tabsRef.current.find((item) => item.id === id);
          return current?.dirty ? saveTab(id) : true;
        });
      }

      const operation = (async (): Promise<boolean> => {
        const tab = tabsRef.current.find((item) => item.id === id);
        const handle = handles.current.get(id);
        if (!tab || !handle) return false;
        const savedRevision = revisions.current.get(id) ?? tab.revision;

        patchTab(id, { saving: true });
        try {
          const bytes = await handle.exportDocx();
          let path = tab.path;

          if (!path || forceDialog) {
            const chosen = await saveDialog({
              title: "保存文档",
              defaultPath: tab.path ?? tab.name,
              filters: [{ name: "Word 文档", extensions: ["docx"] }],
            });
            if (!chosen) return false;
            path = chosen;
          }

          await writeDocument(path, bytes);
          const hasNewerChanges = (revisions.current.get(id) ?? savedRevision) !== savedRevision;
          patchTab(id, {
            path,
            name: baseName(path),
            data: bytes,
            size: bytes.length,
            dirty: hasNewerChanges,
          });
          setRecent(await pushRecent(path));
          return true;
        } catch (error) {
          pushToast("error", errorMessage(error));
          return false;
        } finally {
          patchTab(id, { saving: false });
        }
      })();

      saveOperations.current.set(id, operation);
      const releaseLock = () => {
        if (saveOperations.current.get(id) === operation) {
          saveOperations.current.delete(id);
        }
      };
      void operation.then(releaseLock, releaseLock);
      return operation;
    },
    [patchTab, pushToast],
  );

  useEffect(() => {
    if (!autoSave) return;
    const timers = tabs
      .filter((tab) => tab.dirty && tab.path && !tab.opening && !tab.openError)
      .map((tab) =>
        window.setTimeout(() => {
          void saveTab(tab.id);
        }, AUTO_SAVE_DELAY),
      );
    return () => timers.forEach(window.clearTimeout);
  }, [autoSave, saveTab, tabs]);

  const markTabDirty = useCallback((id: string) => {
    revisions.current.set(id, (revisions.current.get(id) ?? 0) + 1);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === id ? { ...tab, dirty: true, revision: tab.revision + 1 } : tab,
      ),
    );
  }, []);

  const closeTab = useCallback((id: string) => {
    handles.current.delete(id);
    revisions.current.delete(id);
    saveOperations.current.delete(id);
    setMounted((prev) => prev.filter((item) => item !== id));
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === id);
      const next = prev.filter((tab) => tab.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        const fallback = next[Math.min(index, next.length - 1)];
        return fallback ? fallback.id : null;
      });
      return next;
    });
  }, []);

  const requestClose = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((item) => item.id === id);
      if (tab?.dirty) {
        setPending({ kind: "tab", id });
        return;
      }
      closeTab(id);
    },
    [closeTab],
  );

  const zoomBy = useCallback((direction: 1 | -1) => {
    const id = activeIdRef.current;
    if (!id) return;
    const handle = handles.current.get(id);
    if (!handle) return;
    if (direction > 0) handle.zoomIn();
    else handle.zoomOut();
    setZoom(handle.getZoom() / 100);
  }, []);

  // The status-bar menu picks a rung directly instead of walking the ladder.
  const zoomTo = useCallback((percent: number) => {
    const id = activeIdRef.current;
    if (!id) return;
    const handle = handles.current.get(id);
    if (!handle) return;
    handle.setZoom(percent);
    setZoom(handle.getZoom() / 100);
  }, []);

  // "页宽" is the adaptive scale, not a pinned percentage.
  const zoomFit = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    const handle = handles.current.get(id);
    if (!handle) return;
    handle.resetZoom();
    setZoom(handle.getZoom() / 100);
  }, []);

  // Undecorated windows lose the native menu, so the shortcuts it would have
  // owned are registered here instead.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const id = activeIdRef.current;

      switch (event.code) {
        case "KeyN":
          event.preventDefault();
          handleNew();
          break;
        case "KeyO":
          event.preventDefault();
          void handleOpen();
          break;
        case "KeyS":
          event.preventDefault();
          if (id) void saveTab(id, event.shiftKey);
          break;
        case "KeyW":
          event.preventDefault();
          if (id) requestClose(id);
          break;
        case "Equal":
        case "NumpadAdd":
          event.preventDefault();
          zoomBy(1);
          break;
        case "Minus":
        case "NumpadSubtract":
          event.preventDefault();
          zoomBy(-1);
          break;
        case "Digit0":
        case "Numpad0":
          event.preventDefault();
          if (id) zoomFit();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNew, handleOpen, requestClose, saveTab, zoomBy, zoomFit]);

  // Ctrl + wheel zooms the document (handled by the editor surface). The webview
  // would otherwise scale the whole shell — toolbar, sidebar and status bar
  // included — so the browser's own page zoom is cancelled everywhere.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Dropping a file anywhere on the window opens it, which is the fastest path
  // into the app and avoids a trip through the file dialog.
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setDragging(true);
      } else if (payload.type === "drop") {
        setDragging(false);
        void openPaths(payload.paths);
      } else {
        setDragging(false);
      }
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [openPaths]);

  // A second launch exits immediately and forwards the documents it was asked
  // to open to the instance that is already running.
  useEffect(() => {
    const unlisten = listen<string[]>("open-files", (event) => {
      void openPaths(event.payload);
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [openPaths]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      if (tabsRef.current.some((tab) => tab.dirty)) {
        event.preventDefault();
        setPending({ kind: "window" });
      }
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);

  const pendingTab = pending?.kind === "tab" ? tabs.find((t) => t.id === pending.id) : null;
  const dirtyCount = tabs.filter((tab) => tab.dirty).length;

  const confirmActions: ConfirmAction[] =
    pending?.kind === "tab" && pendingTab
      ? [
          {
            label: "不保存",
            tone: "danger",
            onSelect: () => {
              const id = pendingTab.id;
              setPending(null);
              closeTab(id);
            },
          },
          {
            label: "保存并关闭",
            tone: "primary",
            onSelect: async () => {
              const id = pendingTab.id;
              const saved = await saveTab(id);
              setPending(null);
              if (saved) closeTab(id);
            },
          },
        ]
      : [
          {
            label: "不保存并退出",
            tone: "danger",
            onSelect: async () => {
              setPending(null);
              await getCurrentWindow().destroy();
            },
          },
          {
            label: "保存并退出",
            tone: "primary",
            onSelect: async () => {
              const dirty = tabsRef.current.filter((tab) => tab.dirty);
              setPending(null);
              for (const tab of dirty) {
                const saved = await saveTab(tab.id);
                if (!saved) return;
              }
              await getCurrentWindow().destroy();
            },
          },
        ];

  const tabDescriptors: TabDescriptor[] = tabs.map((tab) => ({
    id: tab.id,
    name: tab.name,
    kind: tab.kind,
    dirty: tab.dirty,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <TitleBar
        tabs={tabDescriptors}
        activeId={activeId}
        sidebarOpen={sidebarOpen}
        onSelectTab={selectTab}
        onCloseTab={requestClose}
        onNewTab={handleNew}
        onToggleSidebar={toggleSidebar}
        onShowWelcome={() => setWelcomeOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <div
          id="app-sidebar"
          className={clsx(
            "relative shrink-0 overflow-hidden border-r border-line bg-surface-muted transition-[width] duration-200 ease-out motion-reduce:transition-none",
            sidebarOpen ? "w-[224px]" : "w-[56px]",
          )}
        >
          <Sidebar
            collapsed={!sidebarOpen}
            hasActive={activeTab !== null}
            isDark={isDark}
            accent={accent}
            onNew={handleNew}
            onOpen={handleOpen}
            onSave={() => {
              if (activeId) void saveTab(activeId);
            }}
            onToggleMode={toggleMode}
            onAccentChange={selectAccent}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {showWelcome && (
              <EmptyState
                recent={recent}
                onOpen={handleOpen}
                onNew={handleNew}
                onOpenRecent={(entry) => void openPaths([entry.path])}
                onRemoveRecent={async (entry) => {
                  try {
                    setRecent(await removeRecent(entry.path));
                  } catch (error) {
                    pushToast("error", errorMessage(error));
                  }
                }}
              />
            )}

            {tabs
              .filter((tab) => mounted.includes(tab.id))
              .map((tab) => (
                <div
                  key={tab.id}
                  className={clsx(
                    "h-full",
                    (showWelcome || tab.id !== activeId) && "hidden",
                  )}
                >
                  {tab.data ? (
                    <DocxView
                      bytes={tab.data}
                      colorMode={isDark ? "dark" : "light"}
                      onReady={(handle) => {
                        handles.current.set(tab.id, handle);
                      }}
                      onDirty={() => markTabDirty(tab.id)}
                      onError={(message) => pushToast("error", message)}
                      // Background tabs keep their editors mounted; only the
                      // document on screen may own the status-bar readout.
                      onZoomChange={(value) => {
                        if (tab.id === activeIdRef.current) setZoom(value);
                      }}
                      onSave={() => void saveTab(tab.id)}
                    />
                  ) : (
                    <DocxLoadingState error={tab.openError} />
                  )}
                </div>
              ))}
          </div>
        </main>
      </div>

      <StatusBar
        name={statusTab?.name ?? null}
        kind={statusTab?.kind ?? null}
        size={statusTab?.size ?? 0}
        dirty={statusTab?.dirty ?? false}
        persisted={statusTab?.path != null}
        saving={statusTab?.saving ?? false}
        zoom={zoom}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onZoomTo={zoomTo}
        onZoomFit={zoomFit}
        hint={recent.length > 0 ? "Ctrl + O 打开文档" : "就绪"}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "window" ? "有未保存的修改" : "关闭前保存修改？"}
        description={
          pending?.kind === "window"
            ? `${dirtyCount} 个文档还有未保存的修改，退出后将丢失。`
            : `「${pendingTab?.name ?? ""}」还有未保存的修改。`
        }
        actions={confirmActions}
        onCancel={() => setPending(null)}
      />

      <SettingsDialog
        open={settingsOpen}
        autoSave={autoSave}
        onAutoSaveChange={setAutoSave}
        onClose={() => setSettingsOpen(false)}
      />

      {dragging && <DropOverlay />}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
