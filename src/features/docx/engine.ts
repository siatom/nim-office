import type { Editor } from "@docx-editor.dev/react";
import { commandForSlot, type ZoomMode } from "@docx-editor.dev/core";

/**
 * The surface the app depends on, independent of the document engine behind it.
 *
 * `App.tsx` only ever talks to this interface, so swapping engines (or upgrading
 * one) stays a change inside `features/docx` instead of leaking into tabs,
 * saving, shortcuts, or the status bar.
 */
export interface DocxEngineHandle {
  /** Serialize the edited document back to DOCX bytes. */
  exportDocx: () => Promise<Uint8Array>;
  /** Current display scale as a percentage (100 = authored size). */
  getZoom: () => number;
  getZoomMode: () => ZoomDisplayMode;
  /** Set display scale from a percentage. */
  setZoom: (percent: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitPage: () => void;
  /** Toggle superscript or subscript on the current selection. */
  formatScript: (script: "superscript" | "subscript") => void;
  /** Read current editor text for read-only assistant context. */
  getDocumentContext: () => { text: string; headings: string[]; pageCount: number };
  /** Reserved for a future confirmed editing workflow; unavailable in read-only mode. */
  applyDocumentPatch?: (request: DocxPatchRequest) => Promise<void>;
}

export type ZoomDisplayMode = "fixed" | "page-width" | "page";

/** A future, explicit write request; assistant chat intentionally has no writer yet. */
export interface DocxPatchRequest { operations: Array<{ kind: string; payload: unknown }> }

interface ZoomModeController {
  get: () => ZoomDisplayMode;
  set: (mode: ZoomDisplayMode) => void;
  fitPage: () => void;
}

/** Zoom ladder shared by the shortcuts and the status-bar readout. */
export const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

/**
 * The resting scale: the page fills the width left beside the navigation pane and
 * follows the window from there. The packaged default stops shrinking at 50%,
 * which leaves a page wider than a narrow window clipped at the right edge, so the
 * floor sits low enough that the whole sheet stays visible.
 */
export const FIT_ZOOM_MODE: ZoomMode = {
  type: "fit",
  fit: "pageWidth",
  minZoom: 0.3,
  maxZoom: 5,
};

/** Bounds for the continuous scale that Ctrl + wheel drives. */
const MIN_ZOOM = 30;
const MAX_ZOOM = 400;

/**
 * Ctrl + wheel moves in even steps instead of jumping rungs: a fitted page sits
 * on arbitrary percentages (57%), and the ladder would answer 67% then 50%,
 * which reads as a jump rather than a nudge.
 */
export function nudgeZoom(editor: Editor, delta: number): void {
  const next = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Math.round(editor.getZoom() * 100) + delta),
  );
  editor.setZoom(next / 100);
}

/**
 * Moves to the next rung of {@link ZOOM_STEPS}. Shared by the status-bar buttons
 * and the shortcuts so every discrete entry point lands on the same scale.
 */
export function stepZoom(editor: Editor, direction: 1 | -1): void {
  const current = Math.round(editor.getZoom() * 100);
  const next =
    direction > 0
      ? (ZOOM_STEPS.find((value) => value > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
      : ([...ZOOM_STEPS].reverse().find((value) => value < current) ?? ZOOM_STEPS[0]);
  editor.setZoom(next / 100);
}

/** Adapts a docx-editor `Editor` instance to the app's engine contract. */
export function createDocxEngine(
  editor: Editor,
  zoomMode: ZoomModeController,
  getDocumentContext: DocxEngineHandle["getDocumentContext"],
): DocxEngineHandle {
  const currentPercent = () => Math.round(editor.getZoom() * 100);

  return {
    exportDocx: async () => new Uint8Array(await editor.save()),
    getZoom: currentPercent,
    getZoomMode: zoomMode.get,
    setZoom: (percent) => {
      zoomMode.set("fixed");
      editor.setZoom(percent / 100);
    },
    zoomIn: () => {
      zoomMode.set("fixed");
      stepZoom(editor, 1);
    },
    zoomOut: () => {
      zoomMode.set("fixed");
      stepZoom(editor, -1);
    },
    // Back to the adaptive scale rather than a pinned 100%: the window decides.
    resetZoom: () => {
      zoomMode.set("page-width");
      editor.setZoomMode(FIT_ZOOM_MODE);
    },
    fitPage: zoomMode.fitPage,
    formatScript: (script) => {
      const command = commandForSlot(script === "superscript" ? "script.super" : "script.sub");
      if (command) editor.exec(command);
    },
    getDocumentContext,
  };
}
