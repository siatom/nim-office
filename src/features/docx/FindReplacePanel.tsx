import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  useDocxEditor,
  useDocumentSearch,
  useTranslation,
} from "@docx-editor.dev/react";
import { ArrowLeftRight, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import clsx from "clsx";

/**
 * The navigation pane's Find tab, extended with replace. It stands in for the
 * packaged `DocxEditor.Navigation.Find`, so it keeps that panel's ids and class
 * names — the pane's focus and shortcut handling looks them up — and shares the
 * same editor-wide search session. Replacement uses the engine's `replaceMatch`
 * command; replace-all replays it over every match inside one history group, so
 * a single undo reverts the whole batch.
 */
export function FindReplacePanel({ active, open }: { active: boolean; open: boolean }) {
  const editor = useDocxEditor();
  const search = useDocumentSearch({ highlight: "none" });
  const { t } = useTranslation();
  const [replacement, setReplacement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && open) findRef.current?.focus();
  }, [active, open]);

  const hasQuery = search.query.trim().length > 0;
  const total = search.matches.length;
  const canReplace = hasQuery && (search.activeMatch !== null || total > 0);
  const canReplaceAll = hasQuery && total > 0;

  const runSearchNow = () =>
    search.find(search.query, {
      matchCase: search.matchCase,
      wholeWord: search.wholeWord,
    });

  const updateQuery = (value: string) => {
    setNotice(null);
    search.setQuery(value);
  };

  const updateReplacement = (value: string) => {
    setNotice(null);
    setReplacement(value);
  };

  const replaceOne = () => {
    if (!editor || !hasQuery) return;
    if (search.isPending) runSearchNow();

    const match = search.activeMatch;
    if (!match) {
      // The first press lands on the first occurrence; the next one replaces it,
      // so a replacement never fires on a target the writer has not seen.
      if (total > 0) search.goTo(0);
      return;
    }

    const index = search.matches.indexOf(match);
    const result = editor.exec({ type: "replaceMatch", match, text: replacement });
    const matches = runSearchNow();
    if (!result.ok) return;

    // Document order survives the edit, so the occurrence after the replaced one
    // starts at the old index. Matches inside the inserted text are skipped, which
    // only matters when the replacement itself contains the query.
    const insertedEnd = match.start + replacement.length;
    let next = matches.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex >= index &&
        !(
          candidate.blockId === match.blockId &&
          candidate.start >= match.start &&
          candidate.start < insertedEnd
        ),
    );
    if (next < 0 && matches.length > 0) next = 0;
    if (next >= 0) search.goTo(next);
  };

  const replaceAll = () => {
    if (!editor || !hasQuery) return;
    const matches = search.isPending ? runSearchNow() : search.matches;
    if (matches.length === 0) return;

    // The tree editor does not implement `replaceAllMatches`, so apply the
    // replacements back to front: replacing from the end of each paragraph keeps
    // the offsets of the matches still to come valid.
    const truncated = search.truncated;
    const group = editor.beginHistoryGroup();
    let replaced = 0;
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const result = editor.exec(
        { type: "replaceMatch", match: matches[index], text: replacement },
        { historyGroup: group },
      );
      if (result.ok) replaced += 1;
    }
    group.end();
    runSearchNow();
    setNotice(`已替换 ${replaced}${truncated ? "+" : ""} 处`);
  };

  const onFindKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (search.isPending) runSearchNow();
    if (event.shiftKey) search.previous();
    else search.next();
  };

  const onReplaceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    replaceOne();
  };

  const counter = !hasQuery
    ? ""
    : total === 0
      ? search.isPending
        ? t("navigation.find.searching")
        : t("navigation.find.noResults")
      : search.activeIndex < 0
        ? t(search.truncated ? "navigation.find.totalTruncated" : "navigation.find.total", {
            total,
          })
        : t(
            search.truncated ? "navigation.find.counterTruncated" : "navigation.find.counter",
            { current: search.activeIndex + 1, total },
          );

  return (
    <div
      className="docx-nav__panel"
      role="tabpanel"
      id="docx-nav-panel-find"
      aria-labelledby="docx-nav-tab-find"
      hidden={!active}
    >
      <div className="docx-nav__searchbox">
        <Search size={16} strokeWidth={1.9} className="docx-nav__search-icon" aria-hidden />
        <input
          ref={findRef}
          type="search"
          className="docx-nav__search-input"
          value={search.query}
          placeholder="查找内容"
          aria-label={t("navigation.find.inputAriaLabel")}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={onFindKeyDown}
        />
        {search.query.length > 0 && (
          <button
            type="button"
            className="docx-nav__search-clear"
            aria-label={t("navigation.find.clearAriaLabel")}
            onClick={() => {
              setNotice(null);
              search.clear();
            }}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      <div className="docx-nav__searchbox">
        <ArrowLeftRight size={16} strokeWidth={1.9} className="docx-nav__search-icon" aria-hidden />
        <input
          type="text"
          className="docx-nav__search-input"
          value={replacement}
          placeholder="替换为"
          aria-label="替换为"
          onChange={(event) => updateReplacement(event.target.value)}
          onKeyDown={onReplaceKeyDown}
        />
        {replacement.length > 0 && (
          <button
            type="button"
            className="docx-nav__search-clear"
            aria-label="清除替换内容"
            onClick={() => updateReplacement("")}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-none justify-end gap-1.5">
        <button
          type="button"
          onClick={replaceOne}
          disabled={!canReplace}
          className="h-7 rounded border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-default disabled:opacity-45"
        >
          替换
        </button>
        <button
          type="button"
          onClick={replaceAll}
          disabled={!canReplaceAll}
          className="h-7 rounded border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-default disabled:opacity-45"
        >
          全部替换
        </button>
      </div>

      <div className="docx-nav__options" role="group" aria-label={t("navigation.find.optionsAriaLabel")}>
        <label className="docx-nav__option">
          <input
            type="checkbox"
            checked={search.matchCase}
            onChange={(event) => {
              setNotice(null);
              search.setMatchCase(event.target.checked);
            }}
          />
          {t("navigation.find.matchCase")}
        </label>
        <label className="docx-nav__option">
          <input
            type="checkbox"
            checked={search.wholeWord}
            onChange={(event) => {
              setNotice(null);
              search.setWholeWord(event.target.checked);
            }}
          />
          {t("navigation.find.wholeWord")}
        </label>
      </div>

      <div className="docx-nav__resultbar">
        <span className="docx-nav__count" aria-live="polite">
          {counter}
        </span>
        <span className="docx-nav__steppers">
          <button
            type="button"
            className="docx-nav__stepper"
            aria-label={t("navigation.find.previousAriaLabel")}
            disabled={total === 0}
            onClick={() => search.previous()}
          >
            <ChevronUp size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="docx-nav__stepper"
            aria-label={t("navigation.find.nextAriaLabel")}
            disabled={total === 0}
            onClick={() => search.next()}
          >
            <ChevronDown size={16} strokeWidth={2} aria-hidden />
          </button>
        </span>
      </div>

      {notice && (
        <p role="status" className="m-0 flex-none px-0.5 text-[12px] leading-relaxed text-ink-muted">
          {notice}
        </p>
      )}

      {total > 0 && (
        <ul className="docx-nav__list" aria-label={t("navigation.find.resultsAriaLabel")}>
          {search.matches.map((match, index) => (
            <li key={`${match.blockId}-${match.start}-${index}`}>
              <button
                type="button"
                className={clsx(
                  "docx-nav__result",
                  index === search.activeIndex && "docx-nav__result--active",
                )}
                aria-current={index === search.activeIndex ? "true" : undefined}
                onClick={() => search.goTo(index)}
              >
                <span className="docx-nav__result-text">
                  <bdi>
                    {match.contextBefore}
                    <mark className="docx-nav__result-hit">{match.text}</mark>
                    {match.contextAfter}
                  </bdi>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
