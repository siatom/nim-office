import { buildTheme } from "superdoc";

// SuperDoc's chrome is themed through a CSS class on <html>, not through the
// editor config, so switching themes never remounts the editor.
const light = buildTheme({
  name: "one-office-light",
  radius: "6px",
  font: '"Inter", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  colors: {
    // SuperDoc's chrome follows the app's accent tokens, so a new accent
    // repaints its toolbar without rebuilding or reinjecting this theme.
    action: "var(--accent)",
    actionHover: "var(--accent-hover)",
    actionText: "var(--accent-text)",
    bg: "#ffffff",
    hoverBg: "#f4f4f5",
    activeBg: "#e4e4e7",
    disabledBg: "#fafafa",
    text: "#18181b",
    textMuted: "#71717a",
    textDisabled: "#a1a1aa",
    border: "#e4e4e7",
  },
});

const dark = buildTheme({
  name: "one-office-dark",
  radius: "6px",
  font: '"Inter", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  colors: {
    action: "var(--accent)",
    actionHover: "var(--accent-hover)",
    actionText: "var(--accent-text)",
    bg: "#18181b",
    hoverBg: "#27272a",
    activeBg: "#3f3f46",
    disabledBg: "#1f1f23",
    text: "#f4f4f5",
    textMuted: "#a1a1aa",
    textDisabled: "#52525b",
    border: "#2a2a2e",
  },
});

const STYLE_ID = "one-office-superdoc-theme";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `${light.css}\n${dark.css}`;
  document.head.appendChild(style);
}

/** buildTheme returns a CSS selector (".sd-theme-x"); classList wants a bare name. */
const toClass = (selector: string) => selector.replace(/^\./, "");

export function applySuperdocTheme(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle(toClass(light.className), !isDark);
  root.classList.toggle(toClass(dark.className), isDark);
}
