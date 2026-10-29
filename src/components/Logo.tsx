/** Mirrors src-tauri/app-icon.svg at UI sizes: two stacked sheets with rules. */
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
      <g transform="rotate(7 17.5 13.5)">
        <rect x="11" y="6" width="13" height="15" rx="2.4" fill="#ffffff" opacity="0.36" />
      </g>
      <rect x="8" y="9" width="13" height="15" rx="2.4" fill="#ffffff" />
      <g fill="var(--accent)" opacity="0.42">
        <rect x="10.4" y="12.2" width="8.2" height="1.6" rx="0.8" />
        <rect x="10.4" y="15.6" width="8.2" height="1.6" rx="0.8" />
        <rect x="10.4" y="19" width="5.6" height="1.6" rx="0.8" />
      </g>
    </svg>
  );
}
