import type { DocxEngineHandle, ZoomDisplayMode } from "./engine";

/** Props shared by the lazy boundary and the mounted editor surface. */
export interface DocxSurfaceProps {
  bytes: Uint8Array;
  colorMode: "light" | "dark";
  multiPage: boolean;
  onReady: (handle: DocxEngineHandle) => void;
  onDirty: () => void;
  onError: (message: string) => void;
  onZoomChange: (zoom: number, mode: ZoomDisplayMode) => void;
  onSave?: () => void;
}
