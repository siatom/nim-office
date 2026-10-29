import type { DocumentKind } from "./ipc";

export const KIND_LABEL: Record<DocumentKind, string> = {
  docx: "Word 文档",
  xlsx: "Excel 工作簿",
  pptx: "PowerPoint 演示文稿",
  pdf: "PDF 文档",
  unknown: "未知格式",
};

export const KIND_EXT: Record<DocumentKind, string> = {
  docx: ".docx",
  xlsx: ".xlsx",
  pptx: ".pptx",
  pdf: ".pdf",
  unknown: "",
};

/** Tailwind-safe accent colours per document family. */
export const KIND_COLOR: Record<DocumentKind, string> = {
  docx: "text-[#2b579a] dark:text-[#8ab4f8]",
  xlsx: "text-[#217346] dark:text-[#7fd4a2]",
  pptx: "text-[#c43e1c] dark:text-[#f2a08c]",
  pdf: "text-[#b3261e] dark:text-[#f08c84]",
  unknown: "text-ink-muted",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function stripExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}
