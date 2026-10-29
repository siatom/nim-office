import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import clsx from "clsx";

import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { TabBar, type TabDescriptor } from "./components/TabBar";
import { StatusBar } from "./components/StatusBar";
import { EmptyState } from "./components/EmptyState";
import { ConfirmDialog, type ConfirmAction } from "./components/ConfirmDialog";
import { ToastStack, type ToastItem, type ToastKind } from "./components/Toast";
import { DocxView, type DocxEditorHandle } from "./features/docx/DocxView";
import { useTheme } from "./hooks/useTheme";
import { applySuperdocTheme } from "./lib/superdoc-theme";
import { base64ToBytes } from "./lib/base64";
import {
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
  data: Uint8Array;
  size: number;
  dirty: boolean;
  saving: boolean;
}

const SUPPORTED: DocumentKind[] = ["docx"];

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "发生未知错误";
}

export default function App() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pending, setPending] = useState<
    { kind: "tab"; id: string } | { kind: "window" } | null
  >(null);

  const handles = useRef(new Map<string, DocxEditorHandle>());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null;

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const patchTab = useCallback((id: string, patch: Partial<DocTab>) => {
    setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  useEffect(() => {
    applySuperdocTheme(isDark);
  }, [isDark]);

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
          continue;
        }

        try {
          const payload = await readDocument(path);
          if (!SUPPORTED.includes(payload.kind)) {
            pushToast("info", `${KIND_LABEL[payload.kind]}暂不支持编辑，将在后续版本中提供`);
            continue;
          }

          const id = crypto.randomUUID();
          const tab: DocTab = {
            id,
            path: payload.path,
            name: payload.name,
            kind: payload.kind,
            data: base64ToBytes(payload.data),
            size: payload.size,
            dirty: false,
            saving: false,
          };
          setTabs((prev) => [...prev, tab]);
          setActiveId(id);
          setRecent(await pushRecent(path));
        } catch (error) {
          pushToast("error", errorMessage(error));
        }
      }
    },
    [pushToast],
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
        dirty: false,
        saving: false,
      },
    ]);
    setActiveId(id);
  }, []);

  const saveTab = useCallback(
    async (id: string, forceDialog = false): Promise<boolean> => {
      const tab = tabsRef.current.find((item) => item.id === id);
      const handle = handles.current.get(id);
      if (!tab || !handle) return false;

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
        patchTab(id, {
          path,
          name: baseName(path),
          data: bytes,
          size: bytes.length,
          dirty: false,
        });
        setRecent(await pushRecent(path));
        return true;
      } catch (error) {
        pushToast("error", errorMessage(error));
        return false;
      } finally {
        patchTab(id, { saving: false });
      }
    },
    [patchTab, pushToast],
  );

  const closeTab = useCallback((id: string) => {
    handles.current.delete(id);
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
          if (id) {
            handles.current.get(id)?.resetZoom();
            setZoom(1);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNew, handleOpen, requestClose, saveTab, zoomBy]);

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
      <TitleBar subtitle={activeTab?.name} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          recent={recent}
          hasActive={activeTab !== null}
          isDark={isDark}
          onNew={handleNew}
          onOpen={handleOpen}
          onSave={() => {
            if (activeId) void saveTab(activeId);
          }}
          onOpenRecent={(entry) => void openPaths([entry.path])}
          onRemoveRecent={async (entry) => {
            try {
              setRecent(await removeRecent(entry.path));
            } catch (error) {
              pushToast("error", errorMessage(error));
            }
          }}
          onToggleTheme={toggleTheme}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {tabs.length > 0 && (
            <TabBar
              tabs={tabDescriptors}
              activeId={activeId}
              onSelect={setActiveId}
              onClose={requestClose}
              onNew={handleNew}
            />
          )}

          <div className="relative min-h-0 flex-1">
            {tabs.length === 0 && <EmptyState onOpen={handleOpen} onNew={handleNew} />}

            {tabs
              .filter((tab) => mounted.includes(tab.id))
              .map((tab) => (
                <div key={tab.id} className={clsx("h-full", tab.id !== activeId && "hidden")}>
                  <DocxView
                    bytes={tab.data}
                    onReady={(handle) => {
                      handles.current.set(tab.id, handle);
                    }}
                    onDirty={() => patchTab(tab.id, { dirty: true })}
                    onError={(message) => pushToast("error", message)}
                    onZoomChange={setZoom}
                  />
                </div>
              ))}
          </div>
        </main>
      </div>

      <StatusBar
        name={activeTab?.name ?? null}
        kind={activeTab?.kind ?? null}
        size={activeTab?.size ?? 0}
        dirty={activeTab?.dirty ?? false}
        persisted={activeTab?.path != null}
        saving={activeTab?.saving ?? false}
        zoom={zoom}
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
