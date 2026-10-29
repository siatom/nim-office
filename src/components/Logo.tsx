/** Mirrors src-tauri/app-icon.svg at UI sizes: a single O ring on the accent plate. */
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
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#ffffff"
        d="M16 6.3125A9.6875 9.6875 0 1 0 16 25.6875A9.6875 9.6875 0 1 0 16 6.3125ZM16 10.0625A5.5 5.5 0 1 0 16 21.0625A5.5 5.5 0 1 0 16 10.0625Z"
      />
    </svg>
  );
}
