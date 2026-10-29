import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DocxEditor,
  LocaleProvider,
  NAVIGATION_PANE_WIDTH,
  definePopup,
  useOpenFailure,
  useZoom,
  type Editor,
  type NavigationTabValue,
} from "@docx-editor.dev/react";
import type { DocumentChange } from "@docx-editor.dev/core";
import "@docx-editor.dev/react/styles.css";
import { zhCN } from "@docx-editor.dev/i18n";
import { ListTree, Loader2, Settings2 } from "lucide-react";

import FontFamilyPickerContent from "./FontFamilyPicker";
import { FontSizePicker } from "./FontSizePicker";
import { FindReplacePanel } from "./FindReplacePanel";
import ParagraphDialog from "./ParagraphDialog";
import { ParagraphStylePickerContent } from "./ParagraphStylePicker";
import { ParagraphStyleManager } from "./ParagraphStyleManager";
import { createDocxEngine, FIT_ZOOM_MODE, nudgeZoom, type ZoomDisplayMode } from "./engine";
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
  "--doc-toggle-active-bg": "var(--accent-soft)",
  "--doc-toggle-active-fg": "var(--accent)",
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
 * Below this viewport width the packaged pane would switch to covering the page
 * instead of sitting beside it, so the pane narrows first.
 */
const NARROW_VIEWPORT = 720;
const NARROW_PANE_WIDTH = 260;
/** Long enough for the pane's slide to finish before the page is re-fitted. */
const PANE_SETTLE_MS = 240;
/**
 * A wheel notch arrives as one event but a trackpad reports dozens per gesture,
 * so the wheel nudges the scale at most this often.
 */
const WHEEL_ZOOM_INTERVAL_MS = 80;
/** Percentage points per wheel notch, matching Word's Ctrl + wheel. */
const WHEEL_ZOOM_STEP = 10;
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

/**
 * The Paragraph dialog is the one popup the app replaces: its indent and
 * spacing controls read in the writer's unit (磅/英寸/厘米/毫米/字符) instead of
 * the packaged inches-only fields.
 */
const POPUPS = { paragraph: definePopup(ParagraphDialog) };

/** Disabled reasons the context menu exposes to screen readers only. */
const ENGINE_TEXT: Record<string, string> = {
  "nothing is selected": "没有选中内容",
};

/** Surfaces zoom changes from the engine (toolbar, shortcuts, window) to the host. */
function ZoomWatcher({
  onChange,
  getMode,
}: {
  onChange: (zoom: number, mode: ZoomDisplayMode) => void;
  getMode: () => ZoomDisplayMode;
}) {
  const { zoom, isFit } = useZoom();
  useEffect(() => {
    onChange(zoom, isFit ? "page-width" : getMode());
  }, [zoom, isFit, onChange, getMode]);
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
  // Start every document with the structure pane closed. Restoring an old open
  // preference makes the editor reserve its pane gutter before the pane is
  // visible, shifting the first page right on a restored window.
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [styleManagerOpen, setStyleManagerOpen] = useState(false);
  const [outlineTab, setOutlineTab] = useState<NavigationTabValue>("headings");
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const zoomModeRef = useRef<ZoomDisplayMode>("page-width");
  const fitTimerRef = useRef<number | null>(null);
  const [paneWidth, setPaneWidth] = useState(NAVIGATION_PANE_WIDTH);
  const getZoomMode = useCallback(() => zoomModeRef.current, []);

  const fitPageToViewport = useCallback(() => {
    const editor = editorRef.current;
    const host = hostRef.current;
    const viewport = host?.querySelector<HTMLElement>(
      ".docx-editor-one-surface__viewport, .docx-pages",
    );
    const page = host?.querySelector<HTMLElement>(".docx-page");
    if (!editor || !viewport || !page) return;

    const pageRect = page.getBoundingClientRect();
    if (
      viewport.clientWidth <= 0 ||
      viewport.clientHeight <= 0 ||
      pageRect.width <= 0 ||
      pageRect.height <= 0
    ) {
      return;
    }

    const viewportStyle = window.getComputedStyle(viewport);
    const horizontalPadding =
      Number.parseFloat(viewportStyle.paddingLeft) + Number.parseFloat(viewportStyle.paddingRight);
    const verticalPadding =
      Number.parseFloat(viewportStyle.paddingTop) + Number.parseFloat(viewportStyle.paddingBottom);
    const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding - 32);
    const availableHeight = Math.max(1, viewport.clientHeight - verticalPadding - 32);
    const factor = Math.min(
      availableWidth / pageRect.width,
      availableHeight / pageRect.height,
    );
    const nextZoom = Math.min(5, Math.max(0.1, editor.getZoom() * factor));
    zoomModeRef.current = "page";
    editor.setZoom(nextZoom);
    propsRef.current.onZoomChange(editor.getZoom(), "page");
  }, []);

  const refitPage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (zoomModeRef.current === "page") {
      fitPageToViewport();
      return;
    }
    if (editor.getZoomMode().type !== "fit") return;
    // Pinning the scale first makes the engine measure the latest available width.
    editor.setZoomMode({ type: "fixed" });
    editor.setZoomMode(FIT_ZOOM_MODE);
    zoomModeRef.current = "page-width";
    // The fit lands after a layout pass, which the zoom subscription can miss;
    // report it here so the status bar never sits on a stale 100%.
    propsRef.current.onZoomChange(editor.getZoom(), "page-width");
  }, [fitPageToViewport]);

  const scheduleRefit = useCallback(() => {
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    fitTimerRef.current = window.setTimeout(() => {
      fitTimerRef.current = null;
      refitPage();
    }, PANE_SETTLE_MS);
  }, [refitPage]);

  useEffect(() => () => {
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
  }, []);

  // Opening or closing the pane changes the width the page is fitted to, but the
  // engine only re-fits on a viewport resize. Once the pane's slide settles,
  // re-apply the fit so the page follows the available space.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      refitPage();
    }, PANE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [outlineOpen, paneWidth, refitPage]);

  // The engine covers the page with the pane when the viewport cannot hold both,
  // so a narrow window gets a narrower pane instead of a half-hidden document.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setPaneWidth(
        entry.contentRect.width < NARROW_VIEWPORT ? NARROW_PANE_WIDTH : NAVIGATION_PANE_WIDTH,
      );
      // A restored (non-maximized) window can finish laying out after the editor
      // mounts. Refit after its dimensions settle so the first page is centred.
      scheduleRefit();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [scheduleRefit]);

  // Ctrl + wheel is how Word (and every browser) zooms, and the webview would
  // otherwise scale the whole shell — toolbar and status bar included. Intercept
  // it over the editor and step the page scale instead.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // The listener is non-passive precisely so this can stop the webview zoom.
      event.preventDefault();
      if (event.deltaY === 0) return;
      const editor = editorRef.current;
      if (!editor) return;
      const now = performance.now();
      if (now - lastStep < WHEEL_ZOOM_INTERVAL_MS) return;
      lastStep = now;
      zoomModeRef.current = "fixed";
      nudgeZoom(editor, event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP);
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, []);

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
    editorRef.current = editor;
    // If the outline is hidden, remove its reserved gutter before revealing the
    // document so the first visible frame is centred in the full viewport.
    refitPage();
    setLoading(false);
    // The editor may report ready before the restored window has its final size.
    scheduleRefit();
    propsRef.current.onReady(
      createDocxEngine(editor, {
        get: () => zoomModeRef.current,
        set: (mode) => {
          zoomModeRef.current = mode;
        },
        fitPage: fitPageToViewport,
      }),
    );
    propsRef.current.onZoomChange(editor.getZoom(), zoomModeRef.current);
  }, [fitPageToViewport, refitPage, scheduleRefit]);

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
          popups={POPUPS}
          document={initialDocument}
          mode="edit"
          locale="zh-CN"
          zoomMode={FIT_ZOOM_MODE}
          // The packaged zh-CN catalogue covers every UI string. Names that
          // still read as English here (e.g. "Normal", "Calibri") come from the
          // document's own styles and fonts, and must not be rewritten.
          fonts={systemFontResolver}
          fontShaping={SHAPING}
          onReady={handleReady}
          onChange={handleChange}
          onFontError={(error) => console.warn("[docx] font error", error)}
        >
          <DocxEditor.Toolbar onSave={onSave} className="oo-toolbar">
            {/* No Pro review module is installed, so the comment/tracked-change
                group would only render a disabled control. */}
            <DocxEditor.Toolbar.Group id="review" hidden />
            {/* Keep scripts in the text-formatting group beside strikethrough. */}
            <DocxEditor.Toolbar.Group id="script" hidden />
            {/* Zoom lives in the status bar, next to the other document
                readouts, so the packaged group would duplicate it. */}
            <DocxEditor.Toolbar.Group id="zoom" hidden />
            {/* The packaged picker has no CJK category; this one groups the
                Chinese faces under 中文字体 and keeps a search box. */}
            <DocxEditor.Toolbar.FontFamily>
              <DocxEditor.Toolbar.FontFamily.Trigger />
              <DocxEditor.Toolbar.FontFamily.Content>
                <FontFamilyPickerContent />
              </DocxEditor.Toolbar.FontFamily.Content>
            </DocxEditor.Toolbar.FontFamily>
            <DocxEditor.Toolbar.Slot slotId="font.size">
              <FontSizePicker />
            </DocxEditor.Toolbar.Slot>
            <DocxEditor.Toolbar.StylePicker>
              <ParagraphStylePickerContent />
            </DocxEditor.Toolbar.StylePicker>
            <DocxEditor.Toolbar.Bold className="oo-text-order-1" />
            <DocxEditor.Toolbar.Italic className="oo-text-order-2" />
            <DocxEditor.Toolbar.Underline className="oo-text-order-3" />
            <DocxEditor.Toolbar.Strike className="oo-text-order-4" />
            <DocxEditor.Toolbar.FontColor className="oo-text-order-7" />
            <DocxEditor.Toolbar.Highlight className="oo-text-order-8" />
            <DocxEditor.Toolbar.Link className="oo-text-order-9" />
            <DocxEditor.Toolbar.Group id="text">
              <DocxEditor.Toolbar.Superscript className="oo-text-order-5" />
              <DocxEditor.Toolbar.Subscript className="oo-text-order-6" />
            </DocxEditor.Toolbar.Group>
            <DocxEditor.Toolbar.Action
              label="管理段落样式"
              icon={<Settings2 size={18} strokeWidth={1.8} />}
              onSelect={() => setStyleManagerOpen(true)}
            />
            <DocxEditor.Toolbar.Action
              label="文档结构图"
              icon={<ListTree size={18} strokeWidth={1.8} />}
              active={outlineOpen}
              onSelect={() => setOutlineOpen((open) => !open)}
            />
          </DocxEditor.Toolbar>
          <ParagraphStyleManager
            open={styleManagerOpen}
            onClose={() => setStyleManagerOpen(false)}
            onDirty={onDirty}
          />
          <DocxEditor.HorizontalRuler unit="cm" />
          <div className="relative flex min-h-0 flex-1">
            {/* Headings, find and go-to over the left gutter. The toolbar action is
                the entry point, so the engine's floating disc is suppressed. The tab
                is controlled so the custom Find panel knows when it is showing. */}
            {outlineOpen && (
              <DocxEditor.Navigation
                open
                onOpenChange={setOutlineOpen}
                tab={outlineTab}
                onTabChange={setOutlineTab}
                toggle={false}
                paneWidth={paneWidth}
              >
                <DocxEditor.Navigation.Header />
                <DocxEditor.Navigation.Tabs />
                <DocxEditor.Navigation.Headings />
                <FindReplacePanel active={outlineTab === "find"} open />
                <DocxEditor.Navigation.GoTo />
              </DocxEditor.Navigation>
            )}
            <DocxEditor.Viewport
              className={outlineOpen ? undefined : "oo-docx-viewport--no-outline"}
              style={{ flex: 1, minHeight: 0 }}
            >
              <DocxEditor.Content />
              <DocxEditor.HyperLink />
              <DocxEditor.ContextMenu />
            </DocxEditor.Viewport>
          </div>
          <DocxEditor.FontNotice />
          <ZoomWatcher
            onChange={onZoomChange}
            getMode={getZoomMode}
          />
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
