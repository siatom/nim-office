/**
 * Accent presets.
 *
 * Each preset is a single base colour; the light/dark variants are derived in
 * CSS (`src/index.css`) with `color-mix`, so adding a preset only means picking
 * one hex value that reads well as a filled button under white text.
 */
export interface AccentPreset {
  id: string;
  name: string;
  color: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "indigo", name: "靛蓝", color: "#4f46e5" },
  { id: "violet", name: "鸢尾", color: "#7c3aed" },
  { id: "blue", name: "蔚蓝", color: "#2563eb" },
  { id: "teal", name: "青碧", color: "#0f766e" },
  { id: "emerald", name: "翡翠", color: "#047857" },
  { id: "amber", name: "琥珀", color: "#b45309" },
  { id: "rose", name: "玫瑰", color: "#e11d48" },
  { id: "graphite", name: "石墨", color: "#3f3f46" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0];

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeAccent(value: string | null): string {
  return value && HEX.test(value) ? value.toLowerCase() : DEFAULT_ACCENT.color;
}

export function findPreset(color: string): AccentPreset | undefined {
  return ACCENT_PRESETS.find((preset) => preset.color === color.toLowerCase());
}

/**
 * Ink colour that stays readable on top of `color` when it fills a button.
 * Uses the WCAG relative-luminance crossover (0.18) between white and near-black.
 */
export function readableInk(color: string): string {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(color.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.18 ? "#18181b" : "#ffffff";
}
