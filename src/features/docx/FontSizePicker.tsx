import { useEditorValueCommand } from "@docx-editor.dev/react";

const CHINESE_FONT_SIZES = [
  ["初号", 42],
  ["小初", 36],
  ["一号", 26],
  ["小一", 24],
  ["二号", 22],
  ["小二", 18],
  ["三号", 16],
  ["小三", 15],
  ["四号", 14],
  ["小四", 12],
  ["五号", 10.5],
  ["小五", 9],
  ["六号", 7.5],
  ["小六", 6.5],
  ["七号", 5.5],
  ["八号", 5],
] as const;

/** WPS-style Chinese size names alongside the editor's point-size options. */
export function FontSizePicker() {
  const fontSize = useEditorValueCommand("font.size");
  const currentValue = fontSize.value == null ? "" : String(fontSize.value);
  const values = new Set<number>(fontSize.options);
  CHINESE_FONT_SIZES.forEach(([, points]) => values.add(points * 2));
  if (fontSize.value != null) values.add(fontSize.value);

  const namesByHalfPoint = new Map(CHINESE_FONT_SIZES.map(([name, points]) => [points * 2, name]));
  const orderedValues = [...values].sort((a, b) => a - b);

  return (
    <select
      aria-label="字号"
      className="h-8 w-[88px] rounded-md border border-[var(--doc-border)] bg-[var(--doc-bg-input)] px-2 text-[12px] text-[var(--doc-text)] outline-none focus:border-[var(--doc-primary)]"
      disabled={!fontSize.isEnabled}
      onChange={(event) => fontSize.execute(Number(event.currentTarget.value))}
      value={currentValue}
    >
      {fontSize.value == null && <option value="">字号</option>}
      {orderedValues.map((halfPoints) => {
        const points = halfPoints / 2;
        const name = namesByHalfPoint.get(halfPoints);
        return (
          <option key={halfPoints} value={halfPoints}>
            {name ? `${name}（${points}）` : String(points)}
          </option>
        );
      })}
    </select>
  );
}
