import type { FormNode, PrefillMappings } from '../domain/types';

interface FormListProps {
  forms: readonly FormNode[];
  selectedFormId: string;
  mappings: PrefillMappings;
  onSelect: (formId: string) => void;
}

/** The forms of the blueprint as a navigation list. A row on small screens, a column on large. */
export function FormList({ forms, selectedFormId, mappings, onSelect }: FormListProps) {
  return (
    <nav aria-label="Forms" className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Forms</h3>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {forms.map((form) => {
          const isSelected = form.id === selectedFormId;
          const prefilledCount = mappings.get(form.id)?.size ?? 0;
          return (
            <li key={form.id} className="shrink-0">
              <button
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelect(form.id)}
                className={`flex w-full min-w-36 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="font-medium">{form.name}</span>
                <span className={`text-xs ${isSelected ? 'text-indigo-800' : 'text-slate-500'}`}>
                  {form.fields.length} {form.fields.length === 1 ? 'field' : 'fields'}
                  {prefilledCount > 0 && ` · ${prefilledCount} prefilled`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
