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
};

function getDisplayName(styleId: string, name: string): string {
  const normalizedId = styleId.replace(/[\s_-]/g, "").toLowerCase();
  const headingNumber = normalizedId.match(/^heading([1-9])$/)?.[1];
  if (headingNumber) return `标题${headingNumber}`;

  const builtInName = BUILTIN_STYLE_NAMES[normalizedId];
  if (builtInName) return builtInName;

  const headingName = name.match(/^heading\s*([1-9])$/i)?.[1];
  return headingName ? `标题${headingName}` : name;
}

/** Localizes built-in style labels in the toolbar without changing DOCX metadata. */
export function ParagraphStylePickerContent() {
  const style = useParagraphStyle();
  const StylePicker = DocxEditor.Toolbar.StylePicker;
  const defaultStyle = style.options.find((option) => option.styleId.toLowerCase() === "normal");
  const selectedStyle = style.options.find((option) => option.styleId === style.value);
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
