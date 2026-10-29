import { createFontSource, type FontResolver, type FontSource } from "@docx-editor.dev/core";
import { invoke } from "@tauri-apps/api/core";

import { base64ToBytes } from "../../lib/base64";

interface SystemFontFile {
  id: string;
  data: string;
}

interface SystemFontFace {
  family: string;
  weight: number;
  style: "normal" | "italic";
  fileId: string;
  faceIndex: number;
}

interface SystemFontPayload {
  files: SystemFontFile[];
  faces: SystemFontFace[];
}

// Rust returns one blob per font file, keyed by its stable path. A document
// tab that reuses the same font families only pays for the IPC round trip.
const decodedFiles = new Map<string, Uint8Array>();
const admittedSources = new Map<string, FontSource>();

/**
 * Supplies the bytes of fonts installed on this machine so HarfBuzz can measure
 * and paginate the way Word does. Only families the document actually names are
 * requested; a missing font resolves to nothing and keeps the canvas fallback.
 */
export const systemFontResolver: FontResolver = async (request) => {
  if (request.signal?.aborted) return undefined;

  const families = Array.from(new Set([...request.families, request.defaultFamily]));
  let payload: SystemFontPayload;
  try {
    payload = await invoke<SystemFontPayload>("load_system_fonts", { families });
  } catch (error) {
    console.warn("[docx] could not load system fonts", error);
    return undefined;
  }
  if (request.signal?.aborted) return undefined;

  const byId = new Map(payload.files.map((file) => [file.id, file]));
  const sources: FontSource[] = [];

  for (const face of payload.faces) {
    const cacheKey = `${face.fileId}#${face.faceIndex}#${face.family}#${face.weight}#${face.style}`;
    const cached = admittedSources.get(cacheKey);
    if (cached) {
      sources.push(cached);
      continue;
    }

    let bytes = decodedFiles.get(face.fileId);
    if (!bytes) {
      const file = byId.get(face.fileId);
      if (!file) continue;
      bytes = base64ToBytes(file.data);
      decodedFiles.set(face.fileId, bytes);
    }

    const result = createFontSource(
      bytes,
      {
        family: face.family,
        weight: face.weight,
        style: face.style,
        faceIndex: face.faceIndex,
      },
      { id: cacheKey },
    );

    if ("source" in result) {
      admittedSources.set(cacheKey, result.source);
      sources.push(result.source);
    } else {
      console.warn("[docx] system font rejected", result.failure);
    }
  }

  return { sources, supportedFamilies: families };
};
