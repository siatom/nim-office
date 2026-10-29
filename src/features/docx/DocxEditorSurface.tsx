import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DocxEditor,
  LocaleProvider,
  NAVIGATION_PANE_WIDTH,
  definePopup,
  useHeaderFooterState,
  useOpenFailure,
  useZoom,
  type Editor,
  type NavigationTabValue,
  commandForSlot,
} from "@docx-editor.dev/react";
import type { DocumentChange } from "@docx-editor.dev/core";
import "@docx-editor.dev/react/styles.css";
import { zhCN } from "@docx-editor.dev/i18n";
import { ChevronDown, FileDigit, FilePlus2, FileText, Hash, ListTree, Loader2, LogOut, PanelBottom, PanelTop, Pilcrow, Ruler, Settings2, Rows3 } from "lucide-react";

import FontFamilyPickerContent from "./FontFamilyPicker";
import { FontSizePicker } from "./FontSizePicker";
import { FindReplacePanel } from "./FindReplacePanel";
import ParagraphDialog from "./ParagraphDialog";
import PageMarginsDialog from "./PageMarginsDialog";
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

/** Which furniture story the caret is in, or null while it is in the body. */
type HeaderFooterEditing = "header" | "footer" | null;

/**
 * The parts of "第 X 页，共 Y 页". The engine's own `PAGE_X_OF_Y` joins the two
 * fields with a literal " of ", so the separator has to be written here.
 */
type PageFieldStep = { text: string } | { field: "PAGE" | "NUMPAGES" };
const PAGE_X_OF_Y_ZH: readonly PageFieldStep[] = [
  { text: "第 " },
  { field: "PAGE" },
  { text: " 页，共 " },
  { field: "NUMPAGES" },
  { text: " 页" },
];

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
const MULTI_PAGE_GAP = 24;
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

/**
 * The toolbar swaps its header/footer controls on the engine's scope, and the
 * scope only exists inside `DocxEditor.Root`, so the state comes up through a
 * watcher the same way zoom does.
 */
function HeaderFooterWatcher({
  onChange,
}: {
  onChange: (editing: HeaderFooterEditing) => void;
}) {
  const state = useHeaderFooterState();
  const editing = state?.editing ?? null;
  useEffect(() => {
    onChange(editing);
  }, [editing, onChange]);
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

/**
 * The registry glyph for `insert.footnote` is a raised digit, which reads as
 * superscript beside the script buttons in the same bar. A page with a note
 * rule under it says "footnote" on its own.
 */
function FootnoteIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 10h6" />
      <path d="M6 14.5h12" />
      <path d="M8 18h4" />
    </svg>
  );
}

/** Adds subtle page-corner marks to every rendered sheet. */
function PageCornerMarks({ hostRef }: { hostRef: { current: HTMLDivElement | null } }) {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const addMarks = () => {
      for (const page of host.querySelectorAll<HTMLElement>(".docx-page")) {
        if (page.querySelector(":scope > .oo-page-corner-marks")) continue;
        const marks = page.ownerDocument.createElement("div");
        marks.className = "oo-page-corner-marks";
        marks.setAttribute("aria-hidden", "true");
        const mark = page.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
        mark.classList.add("oo-page-corner-mark");
        for (let i = 0; i < 4; i += 1) {
          mark.append(page.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path"));
        }
        marks.append(mark);
        page.append(marks);
      }
      for (const page of host.querySelectorAll<HTMLElement>(".docx-page")) {
        const marks = page.querySelector<HTMLElement>(":scope > .oo-page-corner-marks");
        const content = page.querySelector<HTMLElement>(".docx-page-content");
        if (!marks || !content) continue;
        const pageRect = page.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        if (!pageRect.width || !pageRect.height) continue;
        const scaleX = page.offsetWidth ? pageRect.width / page.offsetWidth : 1;
        const scaleY = page.offsetHeight ? pageRect.height / page.offsetHeight : 1;
        const width = contentRect.width / scaleX;
        const height = contentRect.height / scaleY;
        const arm = Math.min(22, width / 3, height / 3);
        const mark = marks.querySelector<SVGSVGElement>(".oo-page-corner-mark");
        if (!mark) continue;
        const svgWidth = width + arm * 2;
        const svgHeight = height + arm * 2;
        mark.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
        const paths = mark.querySelectorAll("path");
        const corners = [
          `M ${arm} 0 V ${arm} H 0`,
          `M ${width + arm} 0 V ${arm} H ${svgWidth}`,
          `M ${arm} ${svgHeight} V ${height + arm} H 0`,
          `M ${width + arm} ${height + arm} V ${svgHeight} H ${svgWidth}`,
        ];
        paths.forEach((path, index) => path.setAttribute("d", corners[index]));
        Object.assign(mark.style, {
          position: "absolute",
          left: `${-arm}px`,
          top: `${-arm}px`,
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
        });
        Object.assign(marks.style, {
          inset: "auto",
          left: `${(contentRect.left - pageRect.left) / scaleX}px`,
          top: `${(contentRect.top - pageRect.top) / scaleY}px`,
          width: `${width}px`,
          height: `${height}px`,
        });
      }
    };
    addMarks();
    const observer = new MutationObserver(addMarks);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [hostRef]);
  return null;
}

export default function DocxEditorSurface({
  bytes,
  colorMode,
  multiPage,
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
  const [breakMenuOpen, setBreakMenuOpen] = useState(false);
  const [paragraphMarksVisible, setParagraphMarksVisible] = useState(false);
  const breaksAnchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!breakMenuOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !breaksAnchorRef.current?.contains(target)) setBreakMenuOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBreakMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [breakMenuOpen]);
  const [pageMarginsOpen, setPageMarginsOpen] = useState(false);
  const [headerFooter, setHeaderFooter] = useState<HeaderFooterEditing>(null);
  const [outlineTab, setOutlineTab] = useState<NavigationTabValue>("headings");
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const zoomModeRef = useRef<ZoomDisplayMode>("fixed");
  const multiPageRef = useRef(multiPage);
  multiPageRef.current = multiPage;
  const fitTimerRef = useRef<number | null>(null);
  const [paneWidth, setPaneWidth] = useState(NAVIGATION_PANE_WIDTH);
  const getZoomMode = useCallback(() => zoomModeRef.current, []);
  const executeInsert = useCallback((slot: "insert.pageBreak" | "insert.sectionBreakNextPage" | "insert.sectionBreakContinuous") => {
    const command = commandForSlot(slot);
    if (command) editorRef.current?.exec(command);
  }, []);
  /**
   * Opening a header or footer materialises an empty one when the section has
   * none, which is what double-clicking the band means in Word. Page-number
   * fields are only accepted inside that scope, so the two live together.
   */
  const editHeaderFooter = useCallback((position: "header" | "footer") => {
    const editor = editorRef.current;
    if (!editor) return;
    const result = editor.exec({ type: "editHeaderFooter", position });
    // A story that had to be materialised is empty and starts centred, as in
    // Word; entering one that already exists leaves its alignment alone.
    if (result.ok && result.changed) {
      editor.exec({ type: "setAlignment", align: "center" });
    }
    editor.focus();
  }, []);
  const exitHeaderFooter = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.exec({ type: "exitHeaderFooter" });
    editor.focus();
  }, []);
  const insertPageField = useCallback((field: "PAGE" | "PAGE_X_OF_Y") => {
    const editor = editorRef.current;
    if (!editor) return;
    if (field === "PAGE") {
      editor.exec({ type: "insertPageField", field: "PAGE" });
      editor.focus();
      return;
    }
    // The engine hard-codes " of " between the two fields, so `PAGE_X_OF_Y`
    // reads "1 of 3" in a Chinese document. Write the same parts by hand.
    // They cannot share one history group — `insertText` and `insertPageField`
    // both refuse a group handle — so the run undoes one part at a time.
    for (const step of PAGE_X_OF_Y_ZH) {
      const result =
        "text" in step
          ? // `insertText` always writes at the selection; the typed signature
            // still asks for a `target`, which the engine rejects at runtime.
            editor.exec(
              { type: "insertText", text: step.text } as unknown as Parameters<Editor["exec"]>[0],
            )
          : editor.exec({ type: "insertPageField", field: step.field });
      if (!result.ok) break;
    }
    editor.focus();
  }, []);
  const toggleParagraphMarks = useCallback(() => {
    const command = commandForSlot("review.paragraphMarks");
    if (command && editorRef.current?.exec(command)) {
      setParagraphMarksVisible(hostRef.current?.querySelector(".docx-show-paragraph-marks") !== null);
    }
  }, []);

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

  const fitMultiPagesToViewport = useCallback(() => {
    const editor = editorRef.current;
    const host = hostRef.current;
    const viewport = host?.querySelector<HTMLElement>(
      ".docx-editor-one-surface__viewport",
    );
    const page = host?.querySelector<HTMLElement>(".docx-pages > .docx-page");
    if (!editor || !host || !viewport || !page || viewport.clientWidth <= 0) return;

    const style = window.getComputedStyle(viewport);
    const horizontalPadding =
      Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding - 32);
    const pageWidthAt100 = page.getBoundingClientRect().width / editor.getZoom();
    if (pageWidthAt100 <= 0) return;

    const pageCount = Math.max(1, host.querySelectorAll(".docx-pages > .docx-page").length);
    const columnsAtScale = (scale: number) =>
      Math.max(
        1,
        Math.floor(
          (availableWidth + MULTI_PAGE_GAP) /
            (pageWidthAt100 * scale + MULTI_PAGE_GAP),
        ),
      );
    const preferredColumns = columnsAtScale(0.75);
    const targetColumns =
      pageCount > 1 && preferredColumns < 2 ? columnsAtScale(0.5) : preferredColumns;
    const columns = Math.min(
      pageCount,
      targetColumns,
    );
    const nextZoom = Math.min(
      1,
      Math.max(
        0.1,
        (availableWidth - MULTI_PAGE_GAP * (columns - 1)) / (pageWidthAt100 * columns),
      ),
    );

    if (editor.getZoomMode().type !== "fixed") editor.setZoomMode({ type: "fixed" });
    zoomModeRef.current = "fixed";
    if (Math.abs(editor.getZoom() - nextZoom) < 0.005) return;
    editor.setZoom(nextZoom);
    propsRef.current.onZoomChange(editor.getZoom(), "fixed");
  }, []);

  const refitPage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (multiPageRef.current) {
      fitMultiPagesToViewport();
      return;
    }
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
  }, [fitPageToViewport, fitMultiPagesToViewport]);

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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let observedPage: HTMLElement | null = null;
    const pageObserver = new ResizeObserver(([entry]) => {
      host.style.setProperty("--oo-multi-page-width", `${entry.contentRect.width}px`);
    });
    const syncPage = () => {
      const page = host.querySelector<HTMLElement>(".docx-pages > .docx-page");
      if (page === observedPage) return;
      pageObserver.disconnect();
      observedPage = page;
      if (page) pageObserver.observe(page);
    };
    const pagesObserver = new MutationObserver(syncPage);
    pagesObserver.observe(host, { childList: true, subtree: true });
    syncPage();
    return () => {
      pagesObserver.disconnect();
      pageObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const viewport = host?.querySelector<HTMLElement>(".docx-editor__scroll-container");
    if (!host || !viewport) return;

    let frame = 0;
    let settleTimer = 0;
    let focusedPageIndex = 0;
    const syncRulerPosition = () => {
      frame = 0;
      const pages = [...host.querySelectorAll<HTMLElement>(".docx-pages > .docx-page")];
      const firstPage = pages[0];
      const selection = document.getSelection();
      const anchor = selection?.anchorNode;
      const selectionPage = anchor instanceof Element
        ? anchor.closest<HTMLElement>(".docx-page")
        : anchor?.parentElement?.closest<HTMLElement>(".docx-page");
      const selectedPageIndex = Number(selectionPage?.dataset.pageIndex);
      if (selectionPage && host.contains(selectionPage) && Number.isFinite(selectedPageIndex)) {
        focusedPageIndex = selectedPageIndex;
      }
      const focusedPage = pages.find((page) => Number(page.dataset.pageIndex) === focusedPageIndex) ?? firstPage;
      const horizontalRuler = host.querySelector<HTMLElement>(".docx-horizontal-ruler");
      const verticalRuler = host.querySelector<HTMLElement>(".docx-vertical-ruler");

      if (!firstPage || !focusedPage || !horizontalRuler || !verticalRuler) {
        for (const property of [
          "--oo-focused-ruler-horizontal-x",
          "--oo-focused-ruler-vertical-y",
        ]) host.style.setProperty(property, "0px");
        return;
      }

      const focusedRect = focusedPage.getBoundingClientRect();
      const contentRect = focusedPage.querySelector<HTMLElement>(".docx-page-content")?.getBoundingClientRect();
      const horizontalRect = horizontalRuler.getBoundingClientRect();
      const verticalRect = verticalRuler.getBoundingClientRect();
      const horizontalX = Number.parseFloat(host.style.getPropertyValue("--oo-focused-ruler-horizontal-x")) || 0;
      const verticalY = Number.parseFloat(host.style.getPropertyValue("--oo-focused-ruler-vertical-y")) || 0;
      const rulerGap = 24;

      host.style.setProperty(
        "--oo-focused-ruler-horizontal-x",
        `${horizontalX + focusedRect.left - horizontalRect.left}px`,
      );
      host.style.setProperty(
        "--oo-focused-ruler-vertical-y",
        `${verticalY + (contentRect?.top ?? focusedRect.top) - rulerGap - verticalRect.top}px`,
      );
    };
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncRulerPosition);
    };

    document.addEventListener("selectionchange", scheduleSync);
    viewport.addEventListener("scroll", scheduleSync, { passive: true });
    host.addEventListener("transitionend", scheduleSync);
    const observer = new MutationObserver(() => {
      scheduleSync();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(scheduleSync, PANE_SETTLE_MS);
    });
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(viewport);
    const pages = host.querySelector<HTMLElement>(".docx-pages");
    if (pages) resizeObserver.observe(pages);
    scheduleSync();

    return () => {
      document.removeEventListener("selectionchange", scheduleSync);
      viewport.removeEventListener("scroll", scheduleSync);
      host.removeEventListener("transitionend", scheduleSync);
      observer.disconnect();
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, []);

  useEffect(() => {
    if (!multiPage) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.setZoomMode({ type: "fixed" });
    zoomModeRef.current = "fixed";
    fitMultiPagesToViewport();
  }, [multiPage, fitMultiPagesToViewport]);

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
    // Open every document at its authored scale; users can still choose a fit
    // mode explicitly from the zoom controls.
    editor.setZoomMode({ type: "fixed" });
    editor.setZoom(1);
    zoomModeRef.current = "fixed";
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
      },
      () => {
        const host = hostRef.current;
        if (!host) return { text: "", headings: [], pageCount: 0 };
        const pages = [...host.querySelectorAll<HTMLElement>(".docx-page")];
        const text = pages.map((page) => page.innerText.trim()).filter(Boolean).join("\n\n");
        const headings = [...host.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,[data-outline-level]")]
          .map((node) => node.innerText.trim()).filter(Boolean);
        return { text, headings: [...new Set(headings)], pageCount: pages.length };
      },
      ),
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
      className={`docx-editor relative flex h-full min-h-0 flex-col${colorMode === "dark" ? " dark" : ""}${multiPage ? " docx-editor--multi-page" : ""}`}
      style={{ ...THEME_VARS, "--oo-outline-shift": `${paneWidth + 48}px`, "--oo-multi-page-width": "800px" } as CSSProperties}
    >
      <LocaleProvider i18n={zhCN}>
        <DocxEditor.Root
          popups={POPUPS}
          document={initialDocument}
          mode="edit"
          locale="zh-CN"
          zoomMode={{ type: "fixed" }}
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
            <button
              type="button"
              className="docx-toolbar__button oo-paragraph-marks-button"
              aria-label="显示段落标记"
              title="显示段落标记"
              aria-pressed={paragraphMarksVisible}
              data-active={paragraphMarksVisible ? "" : undefined}
              onClick={toggleParagraphMarks}
            >
              <Pilcrow size={18} strokeWidth={1.9} />
            </button>
            <DocxEditor.Toolbar.Group id="text">
              <DocxEditor.Toolbar.Superscript className="oo-text-order-5" />
              <DocxEditor.Toolbar.Subscript className="oo-text-order-6" />
            </DocxEditor.Toolbar.Group>
            {/* The packaged Insert group is contextual, so the preset bar never
                renders it and none of its controls have an entry. Compose the
                four a Chinese office document reaches for; the text box,
                watermark, bookmark, endnote and page-number variants stay out
                because they only ever lived in the engine's menu bar, which
                this shell does not render. */}
            <DocxEditor.Toolbar.Group id="oo-insert" label="插入" priority={65}>
              <DocxEditor.Toolbar.ImageInsert />
              <DocxEditor.Toolbar.TableInsert />
              <DocxEditor.Toolbar.Button slotId="insert.footnote" icon={<FootnoteIcon />} />
              <DocxEditor.Toolbar.Button slotId="insert.toc" />
            </DocxEditor.Toolbar.Group>
            {/* Header, footer, and the page-number fields that only exist
                inside them. The group swaps to the in-scope controls once the
                caret moves into a furniture story. */}
            <DocxEditor.Toolbar.Group
              id="oo-header-footer"
              label="页眉页脚"
              priority={55}
              // Page numbers and the way out must stay reachable while the
              // caret is inside a header, even in a narrow window.
              pinned={headerFooter !== null}
            >
              {headerFooter ? (
                <>
                  <DocxEditor.Toolbar.Action
                    label="页码"
                    icon={<Hash size={18} strokeWidth={1.8} />}
                    onSelect={() => insertPageField("PAGE")}
                  />
                  <DocxEditor.Toolbar.Action
                    label="第 X 页，共 Y 页"
                    icon={<FileDigit size={18} strokeWidth={1.8} />}
                    onSelect={() => insertPageField("PAGE_X_OF_Y")}
                  />
                  <DocxEditor.Toolbar.Action
                    label="退出页眉页脚"
                    icon={<LogOut size={18} strokeWidth={1.8} />}
                    onSelect={exitHeaderFooter}
                  />
                </>
              ) : (
                <>
                  <DocxEditor.Toolbar.Action
                    label="页眉"
                    icon={<PanelTop size={18} strokeWidth={1.8} />}
                    onSelect={() => editHeaderFooter("header")}
                  />
                  <DocxEditor.Toolbar.Action
                    label="页脚"
                    icon={<PanelBottom size={18} strokeWidth={1.8} />}
                    onSelect={() => editHeaderFooter("footer")}
                  />
                </>
              )}
            </DocxEditor.Toolbar.Group>
            <DocxEditor.Toolbar.Action
              label="页面设置"
              icon={<Ruler size={18} strokeWidth={1.8} />}
              onSelect={() => setPageMarginsOpen(true)}
            />
            <DocxEditor.Toolbar.Group id="document-breaks" label="分隔符" priority={15}>
              <div
                ref={breaksAnchorRef}
                className="oo-breaks-menu-anchor"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setBreakMenuOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setBreakMenuOpen(false);
                    (event.target as HTMLElement).blur();
                  }
                }}
              >
                <button type="button" className="docx-toolbar__button oo-breaks-trigger" aria-label="插入分隔符" aria-expanded={breakMenuOpen} title="插入分隔符" onClick={() => setBreakMenuOpen((open) => !open)}>
                  <Rows3 size={17} strokeWidth={1.8} /><ChevronDown size={12} strokeWidth={2} />
                </button>
                {breakMenuOpen && <div className="oo-breaks-menu" role="menu">
                  <button role="menuitem" onClick={() => { executeInsert("insert.pageBreak"); setBreakMenuOpen(false); }}><FileText size={16} /><span><b>分页符</b><small>从下一页继续</small></span></button>
                  <button role="menuitem" onClick={() => { executeInsert("insert.sectionBreakNextPage"); setBreakMenuOpen(false); }}><FilePlus2 size={16} /><span><b>下一页分节符</b><small>新节从下一页开始</small></span></button>
                  <button role="menuitem" onClick={() => { executeInsert("insert.sectionBreakContinuous"); setBreakMenuOpen(false); }}><Rows3 size={16} /><span><b>连续分节符</b><small>新节从当前位置开始</small></span></button>
                </div>}
              </div>
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
          <PageMarginsDialog open={pageMarginsOpen} onClose={() => setPageMarginsOpen(false)} />
          <DocxEditor.HorizontalRuler unit="cm" />
          <PageCornerMarks hostRef={hostRef} />
          <div className="relative flex min-h-0 flex-1">
            {/* Headings, find and go-to over the right gutter. The toolbar action is
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
              className={outlineOpen ? "oo-docx-viewport--with-outline" : "oo-docx-viewport--no-outline"}
              style={{ flex: 1, minHeight: 0 }}
            >
              <DocxEditor.VerticalRuler unit="cm" />
              <DocxEditor.Content />
              <DocxEditor.HeaderFooterChrome />
              <DocxEditor.HyperLink />
              <DocxEditor.ContextMenu />
            </DocxEditor.Viewport>
          </div>
          <DocxEditor.FontNotice />
          <ZoomWatcher
            onChange={onZoomChange}
            getMode={getZoomMode}
          />
          <HeaderFooterWatcher onChange={setHeaderFooter} />
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
