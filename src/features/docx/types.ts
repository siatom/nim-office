import type { DocxEngineHandle } from "./engine";

/** Props shared by the lazy boundary and the mounted editor surface. */
export interface DocxSurfaceProps {
  bytes: Uint8Array;
  colorMode: "light" | "dark";
  onReady: (handle: DocxEngineHandle) => void;
  onDirty: () => void;
  onError: (message: string) => void;
  onZoomChange: (zoom: number) => void;
  onSave?: () => void;
}
