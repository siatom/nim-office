import type { Editor } from "@docx-editor.dev/react";

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
  /** Set display scale from a percentage. */
  setZoom: (percent: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

/** Zoom ladder shared by the shortcuts and the status-bar readout. */
export const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

/** Adapts a docx-editor `Editor` instance to the app's engine contract. */
export function createDocxEngine(editor: Editor): DocxEngineHandle {
  const currentPercent = () => Math.round(editor.getZoom() * 100);

  const step = (direction: 1 | -1) => {
    const current = currentPercent();
    const next =
      direction > 0
        ? (ZOOM_STEPS.find((value) => value > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
        : ([...ZOOM_STEPS].reverse().find((value) => value < current) ?? ZOOM_STEPS[0]);
    editor.setZoom(next / 100);
  };

  return {
    exportDocx: async () => new Uint8Array(await editor.save()),
    getZoom: currentPercent,
    setZoom: (percent) => editor.setZoom(percent / 100),
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    resetZoom: () => editor.setZoom(1),
  };
}
