/** Mirrors src-tauri/app-icon.svg at UI sizes: a white N on the accent plate. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path
        d="M10 23V9L22 23V9"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
