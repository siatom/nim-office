import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DocxEditor,
  useDocxEditor,
  useParagraphDialog,
  useTranslation,
  type DocxEditorParagraphDialogProps,
} from "@docx-editor.dev/react";
import { ChevronDown } from "lucide-react";

import {
  DEFAULT_CHAR_POINTS,
  MEASURE_UNITS,
  pointsToUnit,
  stepForUnit,
  twipsToUnit,
  unitToPoints,
  unitToTwips,
  type MeasureUnit,
} from "./measure-units";

/**
 * The engine hands the dialog twips for indents and points for space before and
 * after; the packaged controls hard-code 英寸 and 磅. This replaces those five
 * controls in place, so the rest of the dialog (alignment, tabs, pagination)
 * keeps the engine's own layout and behaviour, while each measurement can be
 * read and typed in the unit the writer thinks in.
 */

/** Measurements that share one unit: the indent block, and the spacing block. */
type MeasureGroup = "indent" | "spacing";

type Units = Record<MeasureGroup, MeasureUnit>;

const DEFAULT_UNITS: Units = { indent: "char", spacing: "pt" };

const UNIT_STORAGE_KEY = "one-office:paragraph-units";

const UnitContext = createContext<{
  units: Units;
  setUnit: (group: MeasureGroup, unit: MeasureUnit) => void;
} | null>(null);

function isMeasureUnit(value: unknown): value is MeasureUnit {
  return MEASURE_UNITS.some((unit) => unit.value === value);
}

function readUnits(): Units {
  try {
    const raw = window.localStorage.getItem(UNIT_STORAGE_KEY);
    if (!raw) return DEFAULT_UNITS;
    const parsed = JSON.parse(raw) as Partial<Record<MeasureGroup, unknown>>;
    return {
      indent: isMeasureUnit(parsed.indent) ? parsed.indent : DEFAULT_UNITS.indent,
      spacing: isMeasureUnit(parsed.spacing) ? parsed.spacing : DEFAULT_UNITS.spacing,
    };
  } catch {
    return DEFAULT_UNITS;
  }
}

function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<Units>(readUnits);

  const setUnit = useCallback((group: MeasureGroup, unit: MeasureUnit) => {
    setUnits((current) => {
      if (current[group] === unit) return current;
      const next = { ...current, [group]: unit };
      try {
        window.localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // A blocked storage write only costs the preference on the next launch.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ units, setUnit }), [units, setUnit]);
  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

function useUnits() {
  const context = useContext(UnitContext);
  if (!context) throw new Error("段落单位控件必须渲染在段落对话框内");
  return context;
}

/**
 * One em of the text being formatted, which is what Word means by 字符. Read
 * once on mount: the dialog is a snapshot of the selection it opened on.
 */
function useCharPoints(): number {
  const editor = useDocxEditor();
  return useMemo(
    () => editor?.query({ type: "selectionFormatting" })?.fontSizePt ?? DEFAULT_CHAR_POINTS,
    [editor],
  );
}

type MeasureLabelKey =
  | "dialogs.paragraph.beforeText"
  | "dialogs.paragraph.afterText"
  | "dialogs.paragraph.spaceBefore"
  | "dialogs.paragraph.spaceAfter"
  | "dialogs.paragraph.by";

type MeasureFieldName =
  | "indentLeft"
  | "indentRight"
  | "specialBy"
  | "spaceBefore"
  | "spaceAfter";

interface MeasureFieldProps {
  name: MeasureFieldName;
  labelKey: MeasureLabelKey;
  /** Which mixed flag makes this control open empty. */
  mixedKey: "indentLeft" | "indentRight" | "special" | "spaceBefore" | "spaceAfter";
  group: MeasureGroup;
  /** The unit the engine stores this value in. */
  stored: "twips" | "points";
}

function MeasureField({ name, labelKey, mixedKey, group, stored }: MeasureFieldProps) {
  const { values, mixed, setValue } = useParagraphDialog();
  const { units, setUnit } = useUnits();
  const { t } = useTranslation();
  const charPoints = useCharPoints();
  const id = useId();

  const unit = units[group];
  const isMixed = mixed[mixedKey];
  const draft = values[name];
  const shown = stored === "twips" ? twipsToUnit(draft, unit, charPoints) : pointsToUnit(draft, unit, charPoints);
  const label = t(labelKey);

  return (
    <>
      <label className="docx-dialog__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="docx-dialog__input"
        min={0}
        step={stepForUnit(unit)}
        value={isMixed ? "" : shown}
        placeholder={isMixed ? t("dialogs.paragraph.mixed") : undefined}
        aria-label={label}
        onChange={(event) => {
          const next = Math.max(0, Number(event.target.value) || 0);
          setValue(
            name,
            stored === "twips" ? unitToTwips(next, unit, charPoints) : unitToPoints(next, unit, charPoints),
          );
        }}
      />
      <span className="oo-unit">
        <select
          className="oo-unit__select"
          value={unit}
          aria-label={`${label}单位`}
          onChange={(event) => setUnit(group, event.target.value as MeasureUnit)}
        >
          {MEASURE_UNITS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} strokeWidth={2.5} className="oo-unit__caret" aria-hidden />
      </span>
    </>
  );
}

/**
 * Drop-in replacement for the packaged Paragraph dialog, registered through
 * `popups.paragraph`. `preset` stays on, so only the named controls change.
 */
export default function ParagraphDialog(props: DocxEditorParagraphDialogProps) {
  return (
    <UnitsProvider>
      <DocxEditor.ParagraphDialog {...props}>
        <DocxEditor.ParagraphDialog.Field name="indentLeft">
          <MeasureField
            name="indentLeft"
            labelKey="dialogs.paragraph.beforeText"
            mixedKey="indentLeft"
            group="indent"
            stored="twips"
          />
        </DocxEditor.ParagraphDialog.Field>
        <DocxEditor.ParagraphDialog.Field name="indentRight">
          <MeasureField
            name="indentRight"
            labelKey="dialogs.paragraph.afterText"
            mixedKey="indentRight"
            group="indent"
            stored="twips"
          />
        </DocxEditor.ParagraphDialog.Field>
        <DocxEditor.ParagraphDialog.Field name="specialBy">
          <MeasureField
            name="specialBy"
            labelKey="dialogs.paragraph.by"
            mixedKey="special"
            group="indent"
            stored="twips"
          />
        </DocxEditor.ParagraphDialog.Field>
        <DocxEditor.ParagraphDialog.Field name="spaceBefore">
          <MeasureField
            name="spaceBefore"
            labelKey="dialogs.paragraph.spaceBefore"
            mixedKey="spaceBefore"
            group="spacing"
            stored="points"
          />
        </DocxEditor.ParagraphDialog.Field>
        <DocxEditor.ParagraphDialog.Field name="spaceAfter">
          <MeasureField
            name="spaceAfter"
            labelKey="dialogs.paragraph.spaceAfter"
            mixedKey="spaceAfter"
            group="spacing"
            stored="points"
          />
        </DocxEditor.ParagraphDialog.Field>
      </DocxEditor.ParagraphDialog>
    </UnitsProvider>
  );
}
