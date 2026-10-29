import { useEffect, useState } from "react";
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

const ARABIC_FONT_SIZES = [
  5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

function optionIdFor(halfPoints: number | null): string {
  if (halfPoints == null) return "";
  const chineseSize = CHINESE_FONT_SIZES.find(([, points]) => points * 2 === halfPoints);
  return chineseSize ? `cn-${halfPoints}` : `pt-${halfPoints}`;
}

/** WPS-style Chinese size names alongside the editor's point-size options. */
export function FontSizePicker() {
  const fontSize = useEditorValueCommand("font.size");
  const [selectedOption, setSelectedOption] = useState(() => optionIdFor(fontSize.value));
  useEffect(() => setSelectedOption(optionIdFor(fontSize.value)), [fontSize.value]);

  const numericValues = new Set<number>(fontSize.options);
  ARABIC_FONT_SIZES.forEach((points) => numericValues.add(points * 2));
  if (fontSize.value != null) numericValues.add(fontSize.value);
  const numericValuesAscending = [...numericValues].sort((a, b) => a - b);

  return (
    <select
      aria-label="字号"
      className="h-8 w-[88px] rounded-md border border-[var(--doc-border)] bg-[var(--doc-bg-input)] px-2 text-[12px] text-[var(--doc-text)] outline-none focus:border-[var(--doc-primary)]"
      disabled={!fontSize.isEnabled}
      onChange={(event) => {
        const optionId = event.currentTarget.value;
        const halfPoints = Number(optionId.slice(optionId.indexOf("-") + 1));
        setSelectedOption(optionId);
        fontSize.execute(halfPoints);
      }}
      value={selectedOption}
    >
      {fontSize.value == null && <option value="">字号</option>}
      {CHINESE_FONT_SIZES.map(([name, points]) => {
        const halfPoints = points * 2;
        return (
          <option key={`cn-${halfPoints}`} value={`cn-${halfPoints}`}>
            {name}
          </option>
        );
      })}
      {numericValuesAscending.map((halfPoints) => {
        const points = halfPoints / 2;
        return (
          <option key={`pt-${halfPoints}`} value={`pt-${halfPoints}`}>
            {String(points)}
          </option>
        );
      })}
    </select>
  );
}
