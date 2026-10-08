import { useRef } from 'react';
import type { FormField, PrefillSource } from '../domain/types';
import type { ResolvedOption } from '../prefill-sources/sections';
import { ChevronRightIcon, CloseIcon, LinkIcon, PlusIcon, WarningIcon } from './icons';

interface PrefillFieldRowProps {
  field: FormField;
  /** The stored mapping of this field, if any. */
  source: PrefillSource | undefined;
  /** The option `source` refers to. Undefined when the source is not available to this form. */
  resolved: ResolvedOption | undefined;
  onEdit: () => void;
  onClear: () => void;
}

const EDIT_BUTTON_CLASSES = {
  empty:
    'border-dashed border-slate-300 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700',
  mapped: 'border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-400',
  unavailable: 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500',
};

/** One field of the selected form with its prefill source, or the means to choose one. */
export function PrefillFieldRow({
  field,
  source,
  resolved,
  onEdit,
  onClear,
}: PrefillFieldRowProps) {
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const state = !source ? 'empty' : resolved ? 'mapped' : 'unavailable';

  // The visible content differs per state; the accessible name always says which field the
  // button belongs to, since every row has one.
  const editLabel = !source
    ? `Select source for ${field.label}`
    : resolved
      ? `Change source for ${field.label}, currently ${resolved.groupLabel} ${resolved.option.label}`
      : `Change source for ${field.label}, currently an unavailable source`;

  // Clearing removes its own button; restore focus to the row's persistent edit button.
  const handleClear = () => {
    onClear();
    // The clear button is about to disappear; keep keyboard focus on this row.
    editButtonRef.current?.focus();
  };

  return (
    <li className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 wrap-anywhere">
        <p className="font-medium text-slate-900">
          {field.label}
          {field.required && (
            <>
              <span aria-hidden="true" className="ml-0.5 text-rose-600">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          <code className="font-mono">{field.key}</code> · {field.type}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-1 sm:items-end">
        <div className="flex min-w-0 items-center gap-1">
          {/*
            One button for all three states, so it stays the same DOM element when a mapping is
            set or cleared and the browser can return focus to it when the picker closes.
          */}
          <button
            ref={editButtonRef}
            type="button"
            onClick={onEdit}
            aria-label={editLabel}
            className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${EDIT_BUTTON_CLASSES[state]}`}
          >
            {!source && (
              <>
                <PlusIcon />
                Select source
              </>
            )}
            {source && resolved && (
              <>
                <LinkIcon className="size-4 text-indigo-600" />
                <span className="truncate">{resolved.groupLabel}</span>
                <ChevronRightIcon className="size-3 text-indigo-400" />
                <span className="truncate font-medium">{resolved.option.label}</span>
              </>
            )}
            {source && !resolved && (
              <>
                <WarningIcon className="size-4 text-amber-600" />
                Unavailable source
              </>
            )}
          </button>
          {source && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear prefill for ${field.label}`}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <CloseIcon />
            </button>
          )}
        </div>
        {source && !resolved && (
          <p className="text-xs text-amber-800">
            <code className="font-mono">{source.key}</code> of{' '}
            <code className="font-mono break-all">{source.ownerId}</code> is not available to this
            form. Choose another source or clear it.
          </p>
        )}
      </div>
    </li>
  );
}
