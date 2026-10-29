import { FileText, FileType2, Plus, Presentation, Table2, X } from "lucide-react";
import clsx from "clsx";
import type { DocumentKind } from "../lib/ipc";
import { KIND_COLOR } from "../lib/format";

export interface TabDescriptor {
  id: string;
  name: string;
  kind: DocumentKind;
  dirty: boolean;
}

const ICONS = {
  docx: FileText,
  xlsx: Table2,
  pptx: Presentation,
  pdf: FileType2,
  unknown: FileText,
};

function TabButton({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: TabDescriptor;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const Icon = ICONS[tab.kind];

  return (
    <div
      className={clsx(
        "group relative flex h-7 max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg pl-2 pr-1 transition-colors",
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-ink-muted hover:bg-surface/60 hover:text-ink",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        title={tab.name}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
      >
        <Icon size={13} className={clsx("shrink-0", KIND_COLOR[tab.kind])} />
        <span className="truncate text-[12px] font-medium">{tab.name}</span>
        {tab.dirty && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-accent"
            aria-label="有未保存的修改"
          />
        )}
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={`关闭 ${tab.name}`}
        className={clsx(
          "grid size-5 shrink-0 place-items-center rounded-md transition-all",
          "opacity-0 group-hover:opacity-100",
          active && "opacity-60",
          "hover:bg-line hover:text-ink",
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: TabDescriptor[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-bg px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onSelect={() => onSelect(tab.id)}
            onClose={() => onClose(tab.id)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onNew}
        aria-label="新建文档"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
