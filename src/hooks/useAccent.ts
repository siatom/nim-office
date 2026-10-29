import { useCallback, useLayoutEffect, useState } from "react";
import { DEFAULT_ACCENT, findPreset, normalizeAccent, readableInk } from "../lib/accents";

const STORAGE_KEY = "one-office.accent";

function readStored(): string {
  return normalizeAccent(localStorage.getItem(STORAGE_KEY));
}

/**
 * Owns the accent colour. The value is a single base hex; every surface derives
 * from it through the `--accent*` variables in `index.css`, including SuperDoc's
 * chrome and the app mark.
 */
export function useAccent() {
  const [color, setColor] = useState(readStored);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-base", color);
    root.style.setProperty("--accent-ink", readableInk(color));
    localStorage.setItem(STORAGE_KEY, color);
  }, [color]);

  const select = useCallback((next: string) => {
    setColor(normalizeAccent(next));
  }, []);

  return {
    color,
    preset: findPreset(color) ?? null,
    isDefault: color === DEFAULT_ACCENT.color,
    select,
  };
}
