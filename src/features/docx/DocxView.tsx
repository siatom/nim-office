import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

import type { DocxSurfaceProps } from "./types";

/**
 * The document engine (~4.6 MB of JS plus the HarfBuzz WASM) is the largest
 * thing the app ships. Load it only when a document tab actually mounts, so
 * the shell, dialogs and empty state stay cheap.
 */
const Surface = lazy(() => import("./DocxEditorSurface"));

export function DocxLoadingState({ error }: { error?: string | null }) {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 text-ink-muted">
        {error ? (
          <>
            <span className="text-[13px] font-medium text-ink">无法打开这个文档</span>
            <span className="max-w-[420px] text-center text-[12px] leading-relaxed">{error}</span>
          </>
        ) : (
          <>
            <Loader2 size={22} className="animate-spin text-accent" />
            <span className="text-[12px]">正在读取文档…</span>
          </>
        )}
      </div>
    </div>
  );
}

export function DocxView(props: DocxSurfaceProps) {
  return (
    <Suspense fallback={<DocxLoadingState />}>
      <Surface {...props} />
    </Suspense>
  );
}
