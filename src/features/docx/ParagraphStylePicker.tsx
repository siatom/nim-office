import { DocxEditor, useParagraphStyle } from "@docx-editor.dev/react";

const BUILTIN_STYLE_NAMES: Record<string, string> = {
  normal: "正文",
  title: "标题",
  subtitle: "副标题",
  nospacing: "无间距",
  listparagraph: "列表段落",
  caption: "题注",
  quote: "引用",
  intensequote: "强调引用",
  bodytext: "正文文本",
  bodytext2: "正文文本 2",
  bodytext3: "正文文本 3",
  emphasis: "强调",
  strong: "着重强调",
  header: "页眉",
  footer: "页脚",
  toc: "目录",
  tocheading: "目录标题",
  tableoffigures: "图表目录",
  indexheading: "索引标题",
  index1: "索引1",
  index2: "索引2",
  index3: "索引3",
};

function normalizeStyleName(value: string): string {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function getDisplayName(styleId: string, name: string): string {
  const normalizedId = normalizeStyleName(styleId);
  const normalizedName = normalizeStyleName(name);
  const headingNumber =
    normalizedId.match(/^heading([1-9])$/)?.[1] ?? normalizedName.match(/^heading([1-9])$/)?.[1];
  if (headingNumber) return `标题${headingNumber}`;

  const builtInName = BUILTIN_STYLE_NAMES[normalizedId] ?? BUILTIN_STYLE_NAMES[normalizedName];
  if (builtInName) return builtInName;

  const tocNumber = normalizedId.match(/^toc([1-9])$/)?.[1] ?? normalizedName.match(/^toc([1-9])$/)?.[1];
  return tocNumber ? `目录${tocNumber}` : name;
}

/** Localizes built-in style labels in the toolbar without changing DOCX metadata. */
export function ParagraphStylePickerContent() {
  const style = useParagraphStyle();
  const StylePicker = DocxEditor.Toolbar.StylePicker;
  const defaultStyle = style.options.find(
    (option) => normalizeStyleName(option.styleId) === "normal" || normalizeStyleName(option.name) === "normal",
  );
  const selectedStyle = style.options.find((option) => option.styleId === style.value)
    ?? style.options.find((option) => normalizeStyleName(option.name) === normalizeStyleName(style.value ?? ""));
  const triggerLabel = selectedStyle
    ? getDisplayName(selectedStyle.styleId, selectedStyle.name)
    : defaultStyle
      ? getDisplayName(defaultStyle.styleId, defaultStyle.name)
      : "段落样式";

  return (
    <>
      <StylePicker.Trigger>{triggerLabel}</StylePicker.Trigger>
      <StylePicker.Content>
        {style.options.map((option) => (
          <StylePicker.Item key={option.styleId} value={option.styleId}>
            {getDisplayName(option.styleId, option.name)}
          </StylePicker.Item>
        ))}
      </StylePicker.Content>
    </>
  );
}
