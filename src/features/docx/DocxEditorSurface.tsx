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

import { createDocxEngine } from "./engine";
import { systemFontResolver } from "./system-fonts";
import type { DocxSurfaceProps } from "./types";

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

/**
 * CJK collections are large (SimSun's TTC is ~17 MB) and the shaping ceiling
 * defaults to 16 MiB, which would silently fall back for Chinese documents.
 */
const SHAPING = { maxFontBytes: 64 * 1024 * 1024 };

/**
 * The engine returns a few refusal reasons as English prose that its locale
 * catalogue does not key. Translate the ones reachable from this toolbar;
 * document data (style names such as "Normal", font names) is intentionally
 * left untouched because Word shows the names stored in the file.
 */
const ENGINE_TITLES: Record<string, string> = {
  "the selection is already at the outermost level": "选区已经在最外层",
  "the selection cannot indent any further": "选区无法继续缩进",
  "nothing is selected": "没有选中内容",
  "nothing to paste": "没有可粘贴的内容",
  "nothing to undo": "没有可撤销的操作",
  "nothing to redo": "没有可重做的操作",
  "comments and tracked changes require the pro review module (@docx-editor.dev/pro)":
    "批注和修订需要 Pro 模块（@docx-editor.dev/pro）",
};

/** Disabled reasons the context menu exposes to screen readers only. */
const ENGINE_TEXT: Record<string, string> = {
  "nothing is selected": "没有选中内容",
};

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

export default function DocxEditorSurface({
  bytes,
  colorMode,
  onReady,
  onDirty,
  onError,
  onZoomChange,
  onSave,
}: DocxSurfaceProps) {
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
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    const translate = () => {
      frame = 0;
      for (const element of host.querySelectorAll("[title]")) {
        const raw = element.getAttribute("title");
        const translated = raw ? ENGINE_TITLES[raw] : undefined;
        if (translated) element.setAttribute("title", translated);
      }
      for (const element of host.querySelectorAll(".docx-editor-sr-only")) {
        const raw = element.textContent?.trim();
        const translated = raw ? ENGINE_TEXT[raw] : undefined;
        if (translated && element.textContent !== translated) element.textContent = translated;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(translate);
    };
    const inDocument = (node: Node) => {
      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return element?.closest(".docx-pages") != null;
    };
    translate();
    const observer = new MutationObserver((records) => {
      // Typing mutates text inside the pages; only chrome needs translating.
      if (records.every((record) => inDocument(record.target))) return;
      schedule();
    });
    observer.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
      childList: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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
      ref={hostRef}
      className={`docx-editor relative flex h-full min-h-0 flex-col${colorMode === "dark" ? " dark" : ""}`}
      style={THEME_VARS}
    >
      <LocaleProvider i18n={zhCN}>
        <DocxEditor.Root
          document={initialDocument}
          mode="edit"
          locale="zh-CN"
          // The packaged zh-CN catalogue covers every UI string. Names that
          // still read as English here (e.g. "Normal", "Calibri") come from the
          // document's own styles and fonts, and must not be rewritten.
          fonts={systemFontResolver}
          fontShaping={SHAPING}
          onReady={handleReady}
          onChange={handleChange}
          onFontError={(error) => console.warn("[docx] font error", error)}
        >
          <DocxEditor.Toolbar onSave={onSave}>
            {/* No Pro review module is installed, so the comment/tracked-change
                group would only render a disabled control. */}
            <DocxEditor.Toolbar.Group id="review" hidden />
          </DocxEditor.Toolbar>
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
