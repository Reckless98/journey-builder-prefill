import { useEffect, useId, useMemo, useRef, useState, type SubmitEvent } from 'react';
import { sourceId } from '../domain/mappings';
import type { PrefillSource } from '../domain/types';
import { filterSections, indexOptions, type PrefillSection } from '../prefill-sources/sections';
import type { PrefillOption } from '../prefill-sources/types';
import { Button } from './Button';
import { ChevronRightIcon, CloseIcon, SearchIcon } from './icons';

interface SourcePickerDialogProps {
  formName: string;
  fieldLabel: string;
  /** Everything on offer for this form. The dialog knows nothing about where it comes from. */
  sections: readonly PrefillSection[];
  /** The field's current mapping, preselected when it is still on offer. */
  currentSource: PrefillSource | undefined;
  onSelect: (source: PrefillSource) => void;
  /** Called after the dialog has closed, however it was closed. */
  onClose: () => void;
}

/**
 * Modal for choosing the source that prefills one field. Mount it to open it.
 *
 * A native `<dialog>` shown with `showModal()` provides the focus trap, Escape, the inert
 * background and focus return. The element always closes itself (a button calling `close()`,
 * Escape, or a click outside) and the parent unmounts it on the `close` event. Unmounting it
 * directly would skip the browser's focus return.
 */
export function SourcePickerDialog({
  formName,
  fieldLabel,
  sections,
  currentSource,
  onSelect,
  onClose,
}: SourcePickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(currentSource);

  useEffect(() => {
    const dialog = dialogRef.current;
    // StrictMode runs effects twice in development; the dialog is already open the second time.
    if (!dialog || dialog.open) return;
    dialog.showModal();
    searchRef.current?.focus();
  }, []);

  const options = useMemo(() => indexOptions(sections), [sections]);
  const currentId = currentSource && sourceId(currentSource);
  const selectedId = selected && sourceId(selected);
  const selectedOption = selectedId === undefined ? undefined : options.get(selectedId);
  const canSubmit = selectedOption !== undefined && selectedId !== currentId;

  const isSearching = query.trim() !== '';
  const filtered = filterSections(sections, query);
  // While searching, a section without matches is noise. Otherwise it is shown with a note,
  // so it is clear that the source exists and has nothing for this form.
  const visibleSections = isSearching
    ? filtered.filter((section) => section.groups.length > 0)
    : filtered;

  // Let the native close event restore focus before the parent unmounts this dialog.
  const close = () => dialogRef.current?.close();

  // A radio change edits only the draft; confirmation commits an available, changed source.
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !canSubmit) return;
    onSelect(selected);
    close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // Light dismiss: also close on a click outside the dialog, where the browser supports it.
      closedby="any"
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-w-none rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              Select a prefill source
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm wrap-anywhere text-slate-600">
              for {formName}
              <ChevronRightIcon className="size-3" />
              <span className="font-medium text-slate-900">{fieldLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="border-b border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600">
            <SearchIcon className="size-4 text-slate-400" />
            <span className="sr-only">Search sources</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by form, data set or field"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {visibleSections.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-600">
              {isSearching
                ? `No sources match “${query.trim()}”.`
                : 'No prefill sources are configured.'}
            </p>
          )}
          {visibleSections.map((section) => {
            const headingId = `${titleId}-${section.providerId}`;
            return (
              <section key={section.providerId} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  {section.label}
                </h3>
                {section.groups.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing available for this form.</p>
                ) : (
                  <div className="space-y-3">
                    {section.groups.map((group) => (
                      <fieldset
                        key={group.id}
                        className="min-w-0 rounded-xl border border-slate-200 p-1.5"
                      >
                        <legend className="px-1.5 text-sm font-semibold">{group.label}</legend>
                        {group.options.map((option) => {
                          const id = sourceId(option.source);
                          return (
                            <OptionRow
                              key={id}
                              id={id}
                              option={option}
                              checked={id === selectedId}
                              onChoose={() => setSelected(option.source)}
                            />
                          );
                        })}
                      </fieldset>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="min-w-0 truncate text-sm text-slate-600">
            {selectedOption ? (
              <>
                Selected:{' '}
                <span className="font-medium text-slate-900">
                  {selectedOption.groupLabel} › {selectedOption.option.label}
                </span>
              </>
            ) : (
              'Nothing selected'
            )}
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              Select
            </Button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

interface OptionRowProps {
  /** The option's source id, used as the radio value. */
  id: string;
  option: PrefillOption;
  checked: boolean;
  onChoose: () => void;
}

/**
 * One selectable source. A native radio input, so the arrow keys move through all options of
 * the dialog and the whole row is the click target.
 */
function OptionRow({ id, option, checked, onChoose }: OptionRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50 has-checked:bg-indigo-50 has-focus-visible:outline-2 has-focus-visible:outline-indigo-600">
      <input
        type="radio"
        name="prefill-source"
        value={id}
        checked={checked}
        onChange={onChoose}
        className="size-4 shrink-0 accent-indigo-600 outline-none"
      />
      <span className="min-w-0 flex-1 font-medium wrap-anywhere">{option.label}</span>
      <code className="max-w-[45%] truncate font-mono text-xs text-slate-600">
        {option.source.key}
      </code>
      {option.valueType && (
        <span className="hidden shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 sm:inline">
          {option.valueType}
        </span>
      )}
    </label>
  );
}
