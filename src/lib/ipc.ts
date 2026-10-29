import { invoke } from "@tauri-apps/api/core";
import { bytesToBase64 } from "./base64";

export type DocumentKind = "docx" | "xlsx" | "pptx" | "pdf" | "unknown";

export interface DocumentSummary {
  path: string;
  name: string;
  kind: DocumentKind;
  size: number;
  modified: number | null;
}

export interface DocumentPayload extends DocumentSummary {
  data: string;
}

export interface RecentEntry {
  path: string;
  name: string;
  kind: DocumentKind;
  openedAt: number;
}

export function readDocument(path: string) {
  return invoke<DocumentPayload>("read_document", { path });
}

/** Fast metadata-only probe used to paint a document tab before large-file I/O begins. */
export function describeDocument(path: string) {
  return invoke<DocumentSummary>("describe_document", { path });
}

export function writeDocument(path: string, bytes: Uint8Array) {
  return invoke<void>("write_document", { path, data: bytesToBase64(bytes) });
}

export function listRecent() {
  return invoke<RecentEntry[]>("list_recent");
}

export function pushRecent(path: string) {
  return invoke<RecentEntry[]>("push_recent", { path });
}

export function removeRecent(path: string) {
  return invoke<RecentEntry[]>("remove_recent", { path });
}

export function clearRecent() {
  return invoke<void>("clear_recent");
}

export function agentChat(baseUrl: string, apiKey: string, model: string, messages: Array<{ role: string; content: string }>) {
  return invoke<string>("agent_chat", { baseUrl, apiKey, model, messages });
}

export function pathExists(path: string) {
  return invoke<boolean>("path_exists", { path });
}
