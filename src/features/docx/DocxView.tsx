import { useEffect, useRef, useState } from "react";
import { SuperDoc } from "superdoc";
import "superdoc/style.css";
import { Loader2 } from "lucide-react";

export interface DocxEditorHandle {
  exportDocx: () => Promise<Uint8Array>;
  getZoom: () => number;
  setZoom: (percent: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

export function DocxView({
  bytes,
  onReady,
  onDirty,
  onError,
  onZoomChange,
}: {
  bytes: Uint8Array;
  onReady: (handle: DocxEditorHandle) => void;
  onDirty: () => void;
  onError: (message: string) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<SuperDoc | null>(null);
  const readyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const toolbar = toolbarRef.current;
    if (!host || !toolbar) return;

    let disposed = false;
    readyRef.current = false;

    const instance = new SuperDoc({
      selector: host,
      documentMode: "editing",
      document: bytes.length > 0 ? bytes : undefined,
      // SuperDoc reports document-open events to a remote endpoint by default;
      // a local-first desktop app must not phone home.
      telemetry: { enabled: false },
      ui: {
        toolbar: { container: toolbar },
        loading: false,
      },
      onReady: () => {
        if (disposed) return;
        readyRef.current = true;
        setLoading(false);
        onZoomChange(instance.getZoom() / 100);

        const step = (direction: 1 | -1) => {
          const current = instance.getZoom();
          const next =
            direction > 0
              ? (ZOOM_STEPS.find((value) => value > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
              : ([...ZOOM_STEPS].reverse().find((value) => value < current) ?? ZOOM_STEPS[0]);
          instance.setZoom(next);
        };

        onReady({
          exportDocx: async () => {
            const blob = await instance.export({
              exportType: ["docx"],
              triggerDownload: false,
            });
            return new Uint8Array(await blob.arrayBuffer());
          },
          getZoom: () => instance.getZoom(),
          setZoom: (percent) => instance.setZoom(percent),
          zoomIn: () => step(1),
          zoomOut: () => step(-1),
          resetZoom: () => instance.setZoom(100),
        });
      },
      onEditorUpdate: () => {
        if (!readyRef.current || disposed) return;
        onDirty();
      },
      onException: (payload) => {
        if (disposed) return;
        setLoading(false);
        const message =
          payload?.error instanceof Error
            ? payload.error.message
            : "文档解析失败，文件可能已损坏或格式不受支持";
        setFailure(message);
        onError(message);
      },
      onZoomChange: (payload) => {
        if (disposed) return;
        onZoomChange((payload?.zoom ?? instance.getZoom()) / 100);
      },
    } as ConstructorParameters<typeof SuperDoc>[0]);

    instanceRef.current = instance;

    return () => {
      disposed = true;
      readyRef.current = false;
      instanceRef.current = null;
      try {
        instance.destroy();
      } catch {
        // SuperDoc can throw while tearing down a half-initialised instance.
      }
      host.innerHTML = "";
      toolbar.innerHTML = "";
    };
    // The editor is intentionally bound to a single document for its lifetime;
    // switching documents remounts this component via a React key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={toolbarRef}
        className="shrink-0 overflow-hidden border-b border-line bg-surface px-2 py-1"
      />
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="superdoc-host h-full" />
        {loading && !failure && (
          <div className="absolute inset-0 grid place-items-center bg-bg">
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
    </div>
  );
}
