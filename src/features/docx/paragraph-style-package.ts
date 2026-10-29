import { unzipSync, zipSync } from "fflate";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const STYLES_PART = "word/styles.xml";
const CHILD_ORDER: Record<string, readonly string[]> = {
  style: ["name", "aliases", "basedOn", "next", "link", "autoRedefine", "hidden", "uiPriority", "semiHidden", "unhideWhenUsed", "qFormat", "pPr", "rPr", "tblPr", "trPr", "tcPr", "tblStylePr", "extLst"],
  pPr: ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "outlineLvl", "divId", "cnfStyle", "rPr"],
  rPr: ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u"],
};

export interface ParagraphStyleDraft {
  name: string;
  basedOn: string;
  fontFamily: string;
  fontSizePt: string;
  bold: "inherit" | "on" | "off";
  italic: "inherit" | "on" | "off";
  color: string;
  alignment: "" | "left" | "center" | "right" | "both";
  spaceBeforePt: string;
  spaceAfterPt: string;
  indentLeftPt: string;
  firstLineIndentPt: string;
}

function directChild(parent: Element, localName: string): Element | null {
  return Array.from(parent.children).find((child) => child.namespaceURI === WORD_NS && child.localName === localName) ?? null;
}

function insertInSchemaOrder(parent: Element, child: Element) {
  const order = CHILD_ORDER[parent.localName] ?? [];
  const childRank = order.indexOf(child.localName);
  const reference = Array.from(parent.children).find((existing) => {
    const existingRank = order.indexOf(existing.localName);
    return existingRank >= 0 && childRank >= 0 && existingRank > childRank;
  });
  parent.insertBefore(child, reference ?? null);
}

function childValue(parent: Element | null, localName: string): string | null {
  const child = parent && directChild(parent, localName);
  return child?.getAttributeNS(WORD_NS, "val") ?? null;
}

function setChildValue(parent: Element, localName: string, value: string | null) {
  let child = directChild(parent, localName);
  if (value == null) {
    child?.remove();
    return;
  }
  if (!child) {
    child = parent.ownerDocument.createElementNS(WORD_NS, `w:${localName}`);
    insertInSchemaOrder(parent, child);
  }
  child.setAttributeNS(WORD_NS, "w:val", value);
}

function readPoints(value: string | null): string {
  if (!value) return "";
  const twips = Number(value);
  return Number.isFinite(twips) ? String(twips / 20) : "";
}

function readStyleId(style: Element): string {
  return style.getAttributeNS(WORD_NS, "styleId") ?? "";
}

function readStyleName(style: Element): string {
  const name = directChild(style, "name");
  return name?.getAttributeNS(WORD_NS, "val") ?? "";
}

function styleElements(root: Element): Element[] {
  return Array.from(root.children).filter(
    (child) => child.namespaceURI === WORD_NS && child.localName === "style",
  );
}

function parseStyles(bytes: Uint8Array): { files: Record<string, Uint8Array>; xml: XMLDocument; stylesRoot: Element } {
  const files = unzipSync(bytes);
  const stylesBytes = files[STYLES_PART];
  if (!stylesBytes) throw new Error("文档没有可编辑的段落样式表");
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(stylesBytes), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("无法解析文档样式表");
  const stylesRoot = xml.getElementsByTagNameNS(WORD_NS, "styles").item(0);
  if (!stylesRoot) throw new Error("文档样式表格式不受支持");
  return { files, xml, stylesRoot };
}

export function readParagraphStyleDraft(bytes: Uint8Array, styleId: string): Partial<ParagraphStyleDraft> {
  const { stylesRoot } = parseStyles(bytes);
  const style = styleElements(stylesRoot).find((item) => readStyleId(item) === styleId);
  if (!style) throw new Error("找不到要编辑的样式");

  const pPr = directChild(style, "pPr");
  const rPr = directChild(style, "rPr");
  const rFonts = rPr && directChild(rPr, "rFonts");
  const size = childValue(rPr, "sz");
  const color = childValue(rPr, "color");
  const bold = childValue(rPr, "b");
  const italic = childValue(rPr, "i");
  const alignment = childValue(pPr, "jc");
  const spacing = pPr && directChild(pPr, "spacing");
  const indent = pPr && directChild(pPr, "ind");

  return {
    name: readStyleName(style),
    basedOn: childValue(style, "basedOn") ?? "",
    fontFamily:
      rFonts?.getAttributeNS(WORD_NS, "eastAsia") ??
      rFonts?.getAttributeNS(WORD_NS, "ascii") ??
      "",
    fontSizePt: size ? String(Number(size) / 2) : "",
    bold: bold == null ? "inherit" : bold === "0" || bold === "false" ? "off" : "on",
    italic: italic == null ? "inherit" : italic === "0" || italic === "false" ? "off" : "on",
    color: color && color !== "auto" ? `#${color}` : "",
    alignment: (alignment as ParagraphStyleDraft["alignment"]) ?? "",
    spaceBeforePt: readPoints(spacing?.getAttributeNS(WORD_NS, "before") ?? null),
    spaceAfterPt: readPoints(spacing?.getAttributeNS(WORD_NS, "after") ?? null),
    indentLeftPt: readPoints(indent?.getAttributeNS(WORD_NS, "left") ?? null),
    firstLineIndentPt: readPoints(indent?.getAttributeNS(WORD_NS, "firstLine") ?? null),
  };
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function setAttribute(parent: Element, localName: string, value: string | null) {
  if (value == null) parent.removeAttributeNS(WORD_NS, localName);
  else parent.setAttributeNS(WORD_NS, `w:${localName}`, value);
}

function setParagraphProperties(style: Element, draft: ParagraphStyleDraft) {
  let pPr = directChild(style, "pPr");
  if (!pPr && (draft.alignment || draft.spaceBeforePt || draft.spaceAfterPt || draft.indentLeftPt || draft.firstLineIndentPt)) {
    pPr = style.ownerDocument.createElementNS(WORD_NS, "w:pPr");
    insertInSchemaOrder(style, pPr);
  }
  if (!pPr) return;

  setChildValue(pPr, "jc", draft.alignment || null);
  let spacing = directChild(pPr, "spacing");
  if (!spacing && (draft.spaceBeforePt || draft.spaceAfterPt)) {
    spacing = style.ownerDocument.createElementNS(WORD_NS, "w:spacing");
    insertInSchemaOrder(pPr, spacing);
  }
  if (spacing) {
    setAttribute(spacing, "before", draft.spaceBeforePt ? String(Math.round(Number(draft.spaceBeforePt) * 20)) : null);
    setAttribute(spacing, "after", draft.spaceAfterPt ? String(Math.round(Number(draft.spaceAfterPt) * 20)) : null);
    if (!spacing.attributes.length) spacing.remove();
  }

  let indent = directChild(pPr, "ind");
  if (!indent && (draft.indentLeftPt || draft.firstLineIndentPt)) {
    indent = style.ownerDocument.createElementNS(WORD_NS, "w:ind");
    insertInSchemaOrder(pPr, indent);
  }
  if (indent) {
    setAttribute(indent, "left", draft.indentLeftPt ? String(Math.round(Number(draft.indentLeftPt) * 20)) : null);
    setAttribute(indent, "firstLine", draft.firstLineIndentPt ? String(Math.round(Number(draft.firstLineIndentPt) * 20)) : null);
    setAttribute(indent, "hanging", null);
    if (!indent.attributes.length) indent.remove();
  }
  if (!pPr.children.length) pPr.remove();
}

function setRunProperties(style: Element, draft: ParagraphStyleDraft) {
  let rPr = directChild(style, "rPr");
  if (!rPr && (draft.fontFamily || draft.fontSizePt || draft.color || draft.bold !== "inherit" || draft.italic !== "inherit")) {
    rPr = style.ownerDocument.createElementNS(WORD_NS, "w:rPr");
    insertInSchemaOrder(style, rPr);
  }
  if (!rPr) return;

  let rFonts = directChild(rPr, "rFonts");
  if (draft.fontFamily) {
    if (!rFonts) {
      rFonts = style.ownerDocument.createElementNS(WORD_NS, "w:rFonts");
      insertInSchemaOrder(rPr, rFonts);
    }
    for (const attribute of ["ascii", "hAnsi", "eastAsia", "cs"]) {
      setAttribute(rFonts, attribute, draft.fontFamily);
    }
  } else {
    rFonts?.remove();
  }

  const size = draft.fontSizePt ? String(Math.round(Number(draft.fontSizePt) * 2)) : null;
  setChildValue(rPr, "sz", size);
  setChildValue(rPr, "szCs", size);
  setChildValue(rPr, "color", draft.color ? draft.color.replace(/^#/, "").toUpperCase() : null);
  setChildValue(rPr, "b", draft.bold === "inherit" ? null : draft.bold === "on" ? "1" : "0");
  setChildValue(rPr, "i", draft.italic === "inherit" ? null : draft.italic === "on" ? "1" : "0");
  if (!rPr.children.length) rPr.remove();
}

function createStyleId(stylesRoot: Element): string {
  const usedIds = new Set(styleElements(stylesRoot).map(readStyleId));
  let styleId = "Custom";
  do {
    styleId = `UserStyle${crypto.randomUUID().replace(/-/g, "")}`;
  } while (usedIds.has(styleId));
  return styleId;
}

export function writeParagraphStyle(
  bytes: Uint8Array,
  draft: ParagraphStyleDraft,
  editingStyleId: string | null,
): { bytes: Uint8Array; styleId: string } {
  const name = draft.name.trim();
  if (!name) throw new Error("请输入样式名称");
  if (draft.fontSizePt && (!Number.isFinite(Number(draft.fontSizePt)) || Number(draft.fontSizePt) <= 0 || Number(draft.fontSizePt) > 1638)) {
    throw new Error("字号需大于 0 且不超过 1638 磅");
  }

  const { files, xml, stylesRoot } = parseStyles(bytes);
  const styles = styleElements(stylesRoot);
  const editing = editingStyleId ? styles.find((item) => readStyleId(item) === editingStyleId) : null;
  if (editingStyleId && !editing) throw new Error("找不到要编辑的样式");
  if (styles.some((item) => item !== editing && normalizeName(readStyleName(item)) === normalizeName(name))) {
    throw new Error("已有同名样式，请换一个名称");
  }
  const pointFields = [draft.spaceBeforePt, draft.spaceAfterPt, draft.indentLeftPt, draft.firstLineIndentPt];
  if (pointFields.some((value) => value !== "" && !Number.isFinite(Number(value)))) {
    throw new Error("段前、段后和缩进请填写有效的磅值");
  }
  if (draft.color && !/^#?[\da-f]{6}$/i.test(draft.color)) {
    throw new Error("文字颜色请输入 6 位十六进制颜色值");
  }
  if (draft.basedOn && !styles.some((item) => readStyleId(item) === draft.basedOn)) {
    throw new Error("请选择有效的基础样式");
  }
  if (editingStyleId) {
    let baseId = draft.basedOn;
    const visited = new Set<string>();
    while (baseId && !visited.has(baseId)) {
      if (baseId === editingStyleId) throw new Error("基础样式不能形成循环继承");
      visited.add(baseId);
      const base = styles.find((item) => readStyleId(item) === baseId);
      baseId = base ? childValue(base, "basedOn") ?? "" : "";
    }
  }

  let styleId: string;
  let target: Element;
  if (editing) {
    styleId = editingStyleId!;
    target = editing;
  } else {
    styleId = createStyleId(stylesRoot);
    const baseStyle = styles.find((item) => readStyleId(item) === draft.basedOn);
    target = baseStyle
      ? (baseStyle.cloneNode(true) as Element)
      : xml.createElementNS(WORD_NS, "w:style");
    setAttribute(target, "styleId", styleId);
    setAttribute(target, "type", "paragraph");
    setAttribute(target, "default", null);
    for (const childName of ["pPr", "rPr", "basedOn", "link", "next", "aliases"]) {
      directChild(target, childName)?.remove();
    }
    if (draft.basedOn) {
      const basedOn = xml.createElementNS(WORD_NS, "w:basedOn");
      setAttribute(basedOn, "val", draft.basedOn);
      insertInSchemaOrder(target, basedOn);
    }
    const styleName = xml.createElementNS(WORD_NS, "w:name");
    setAttribute(styleName, "val", name);
    target.insertBefore(styleName, target.firstChild);
    stylesRoot.insertBefore(target, directChild(stylesRoot, "extLst"));
  }

  const styleName = directChild(target, "name");
  if (styleName) setAttribute(styleName, "val", name);
  else {
    const node = xml.createElementNS(WORD_NS, "w:name");
    setAttribute(node, "val", name);
    target.insertBefore(node, target.firstChild);
  }
  const basedOn = directChild(target, "basedOn");
  if (basedOn && draft.basedOn) setAttribute(basedOn, "val", draft.basedOn);
  else if (basedOn && !draft.basedOn) basedOn.remove();
  else if (!basedOn && draft.basedOn) {
    const node = xml.createElementNS(WORD_NS, "w:basedOn");
    setAttribute(node, "val", draft.basedOn);
    insertInSchemaOrder(target, node);
  }

  setRunProperties(target, draft);
  setParagraphProperties(target, draft);
  files[STYLES_PART] = new TextEncoder().encode(new XMLSerializer().serializeToString(xml));
  return { bytes: zipSync(files, { level: 6 }), styleId };
}
