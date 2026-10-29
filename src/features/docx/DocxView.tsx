import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DocxEditor,
  LocaleProvider,
  useOpenFailure,
  useZoom,
  type Editor,
} from "@docx-editor.dev/react";
import type { DocumentChange } from "@docx-editor.dev/core";
import "@docx-editor.dev/react/styles.css";
import { zhCN } from "@docx-editor.dev/i18n";
import { Loader2 } from "lucide-react";

import { createDocxEngine, type DocxEngineHandle } from "./engine";

/**
 * docx-editor reads its chrome palette from `--doc-*` custom properties.
 * Inline values win over the packaged light/dark palettes, so the editor
 * follows the app tokens (including accent presets) without a rebuild.
 */
const THEME_VARS = {
  "--doc-bg": "var(--bg)",
  "--doc-bg-subtle": "var(--surface-muted)",
  "--doc-surface": "var(--surface)",
  "--doc-card": "var(--surface-raised)",
  "--doc-popover-bg": "var(--surface-raised)",
  "--doc-popover-fg": "var(--text)",
  "--doc-bg-hover": "var(--surface-muted)",
  "--doc-bg-input": "var(--surface)",
  "--doc-border": "var(--border)",
  "--doc-text": "var(--text)",
  "--doc-text-muted": "var(--text-muted)",
  "--doc-text-subtle": "var(--text-subtle)",
  "--doc-primary": "var(--accent)",
  "--doc-primary-hover": "var(--accent-hover)",
  "--doc-primary-light": "var(--accent-soft)",
  "--doc-on-primary": "var(--accent-text)",
  "--doc-focus-ring": "var(--accent)",
  "--doc-font-ui": "var(--font-sans)",
} as CSSProperties;

/** Surfaces zoom changes from the engine (toolbar, shortcuts, window) to the host. */
function ZoomWatcher({ onChange }: { onChange: (zoom: number) => void }) {
  const { zoom } = useZoom();
  useEffect(() => {
    onChange(zoom);
  }, [zoom, onChange]);
  return null;
}

/** Turns a refused open into the app's own error state and hides the packaged dialog. */
function OpenFailureWatcher({ onFailure }: { onFailure: (message: string) => void }) {
  const { failure, message } = useOpenFailure();
  const reported = useRef<unknown>(null);
  useEffect(() => {
    if (!failure || reported.current === failure) return;
    reported.current = failure;
    onFailure(message ?? "文档解析失败，文件可能已损坏或格式不受支持");
  }, [failure, message, onFailure]);
  return null;
}

export function DocxView({
  bytes,
  colorMode,
  onReady,
  onDirty,
  onError,
  onZoomChange,
  onSave,
}: {
  bytes: Uint8Array;
  colorMode: "light" | "dark";
  onReady: (handle: DocxEngineHandle) => void;
  onDirty: () => void;
  onError: (message: string) => void;
  onZoomChange: (zoom: number) => void;
  onSave?: () => void;
}) {
  const readyRef = useRef(false);
  const propsRef = useRef({ onReady, onDirty, onError, onZoomChange });
  useEffect(() => {
    propsRef.current = { onReady, onDirty, onError, onZoomChange };
  }, [onReady, onDirty, onError, onZoomChange]);
  // Freeze the initial bytes: saving replaces tab.data in App, and a new prop
  // identity must not make the engine reload the document under the caret.
  const [initialDocument] = useState(() => (bytes.length > 0 ? bytes : ("blank" as const)));
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const handleReady = useCallback((editor: Editor) => {
    if (readyRef.current) return;
    readyRef.current = true;
    setLoading(false);
    propsRef.current.onReady(createDocxEngine(editor));
    propsRef.current.onZoomChange(editor.getZoom());
  }, []);

  const handleChange = useCallback((change: DocumentChange) => {
    // The initial mount reports a `load` change; everything after it is a user edit.
    if (!readyRef.current || change.source === "load") return;
    propsRef.current.onDirty();
  }, []);

  const handleFailure = useCallback((message: string) => {
    setLoading(false);
    setFailure(message);
    propsRef.current.onError(message);
  }, []);

  return (
    <div
      className={`docx-editor relative flex h-full min-h-0 flex-col${colorMode === "dark" ? " dark" : ""}`}
      style={THEME_VARS}
    >
      <LocaleProvider i18n={zhCN}>
        <DocxEditor.Root
          document={initialDocument}
          mode="edit"
          locale="zh-CN"
          onReady={handleReady}
          onChange={handleChange}
          onFontError={(error) => console.warn("[docx] font error", error)}
        >
          <DocxEditor.Toolbar onSave={onSave} />
          <DocxEditor.Viewport style={{ flex: 1, minHeight: 0 }}>
            <DocxEditor.Content />
            <DocxEditor.HyperLink />
            <DocxEditor.ContextMenu />
          </DocxEditor.Viewport>
          <DocxEditor.FontNotice />
          <ZoomWatcher onChange={onZoomChange} />
          <OpenFailureWatcher onFailure={handleFailure} />
        </DocxEditor.Root>
      </LocaleProvider>

      {loading && !failure && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg">
          <div className="flex flex-col items-center gap-3 text-ink-muted">
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="text-[12px]">正在打开文档…</span>
          </div>
        </div>
      )}

      {failure && (
        <div className="absolute inset-0 grid place-items-center bg-bg px-8">
          <div className="max-w-[420px] text-center">
            <p className="text-[13px] font-medium text-ink">无法打开这个文档</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{failure}</p>
          </div>
        </div>
      )}
    </div>
  );
}
