import { useMemo, useState } from "react";
import { DocxEditor, useFontFamily } from "@docx-editor.dev/react";

import { CHINESE_FAMILIES } from "./system-fonts";

/**
 * Word's font picker separates CJK faces from Latin ones, but the packaged
 * picker only knows the four Latin categories: every Chinese family lands in
 * an unlabelled "other" bucket. This content replaces the default list so
 * 宋体 / 楷体 / 仿宋 / 微软雅黑 and the government-document faces sit under a
 * named 中文字体 group while the Latin categories keep their own headings.
 */

// A Chinese family can be named in Chinese or English depending on the file.
// Keep the aliases in step with FAMILY_GROUPS in src-tauri/src/fonts.rs.
const CHINESE_ALIASES = new Set([
  "simsun",
  "nsimsun",
  "songti",
  "songtisc",
  "simhei",
  "heiti",
  "heitisc",
  "stheiti",
  "kaiti",
  "kaitisc",
  "stkaiti",
  "fangsong",
  "stfangsong",
  "microsoftyahei",
  "microsoftyaheiui",
  "msyh",
  "dengxian",
  "stzhongsong",
  "zhongsong",
  "pingfang",
  "pingfangsc",
  "sourcehansanssc",
  "notosanssc",
  "notosanscjksc",
  "sourcehanserifsc",
  "notoserifsc",
  "notoserifcjksc",
]);

const SANS_FAMILIES = new Set([
  "arial",
  "calibri",
  "helvetica",
  "verdana",
  "opensans",
  "roboto",
]);

const SERIF_FAMILIES = new Set(["timesnewroman", "georgia", "cambria", "garamond"]);
const MONO_FAMILIES = new Set(["couriernew", "consolas"]);

const CJK_NAME = /[\u3400-\u9fff\uf900-\ufaff]/;

function normalizeFamily(family: string): string {
  return family.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isChineseFamily(family: string): boolean {
  return CJK_NAME.test(family) || CHINESE_ALIASES.has(normalizeFamily(family));
}

function sortChinese(fonts: string[]): string[] {
  const preferred = new Map<string, number>(
    CHINESE_FAMILIES.map((name, index) => [name, index] as const),
  );
  return [...fonts].sort((left, right) => {
    const leftIndex = preferred.get(left) ?? Infinity;
    const rightIndex = preferred.get(right) ?? Infinity;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.localeCompare(right, "zh-CN");
  });
}

interface FontGroup {
  id: string;
  label: string;
  fonts: string[];
}

function groupFonts(options: readonly string[], query: string): FontGroup[] {
  const needle = query.trim().toLowerCase();
  const groups: Record<string, string[]> = {
    cjk: [],
    sans: [],
    serif: [],
    mono: [],
    other: [],
  };

  for (const family of options) {
    if (needle && !family.toLowerCase().includes(needle)) continue;
    const key = normalizeFamily(family);
    if (isChineseFamily(family)) groups.cjk.push(family);
    else if (SANS_FAMILIES.has(key)) groups.sans.push(family);
    else if (SERIF_FAMILIES.has(key)) groups.serif.push(family);
    else if (MONO_FAMILIES.has(key)) groups.mono.push(family);
    else groups.other.push(family);
  }

  return [
    { id: "cjk", label: "中文字体", fonts: sortChinese(groups.cjk) },
    { id: "sans", label: "无衬线字体", fonts: groups.sans },
    { id: "serif", label: "衬线字体", fonts: groups.serif },
    { id: "mono", label: "等宽字体", fonts: groups.mono },
    { id: "other", label: "其他字体", fonts: groups.other },
  ].filter((group) => group.fonts.length > 0);
}

/** Dropdown body for the toolbar's `font.family` slot. */
export default function FontFamilyPickerContent() {
  const { options } = useFontFamily();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupFonts(options, query), [options, query]);

  return (
    <>
      <input
        type="search"
        className="docx-toolbar__font-search"
        aria-label="搜索字体"
        placeholder="搜索字体"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        role="listbox"
        aria-label="选择字体"
        className="docx-toolbar__font-options"
      >
        {groups.map((group, index) => (
          <div key={group.id} role="group">
            {index > 0 && (
              <div
                className="docx-toolbar__menu-separator"
                aria-hidden="true"
              />
            )}
            <div className="docx-toolbar__menu-label">{group.label}</div>
            {group.fonts.map((family) => (
              <DocxEditor.Toolbar.FontFamily.Item key={family} value={family} />
            ))}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-3 py-2 text-[12px] text-ink-muted">没有匹配的字体</p>
        )}
      </div>
    </>
  );
}
