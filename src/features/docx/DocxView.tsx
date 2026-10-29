import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

import type { DocxSurfaceProps } from "./types";

/**
 * The document engine (~4.6 MB of JS plus the HarfBuzz WASM) is the largest
 * thing the app ships. Load it only when a document tab actually mounts, so
 * the shell, dialogs and empty state stay cheap.
 */
const Surface = lazy(() => import("./DocxEditorSurface"));

function Loading() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-ink-muted">
        <Loader2 size={22} className="animate-spin text-accent" />
        <span className="text-[12px]">正在打开文档…</span>
      </div>
    </div>
  );
}

export function DocxView(props: DocxSurfaceProps) {
  return (
    <Suspense fallback={<Loading />}>
      <Surface {...props} />
    </Suspense>
  );
}
