import { useId, useMemo, useState } from 'react';
import { sourceId } from '../domain/mappings';
import type { Blueprint, FormNode, FormPrefill, PrefillSource } from '../domain/types';
import { buildSections, indexOptions } from '../prefill-sources/sections';
import type { PrefillSourceProvider } from '../prefill-sources/types';
import { FormDependencies } from './FormDependencies';
import { PrefillFieldRow } from './PrefillFieldRow';
import { SourcePickerDialog } from './SourcePickerDialog';

interface PrefillEditorProps {
  blueprint: Blueprint;
  form: FormNode;
  providers: readonly PrefillSourceProvider[];
  /** The mappings of `form`. Undefined when none of its fields is prefilled. */
  prefill: FormPrefill | undefined;
  onSetMapping: (fieldKey: string, source: PrefillSource) => void;
  onClearMapping: (fieldKey: string) => void;
}

/**
 * Shows and edits the prefill configuration of one form.
 *
 * Providers are consulted once, here. The resulting sections both describe the mappings that
 * exist and fill the picker, so nothing below knows which kinds of source exist.
 *
 * Render with `key={form.id}` so the open-picker state does not carry over between forms.
 */
export function PrefillEditor({
  blueprint,
  form,
  providers,
  prefill,
  onSetMapping,
  onClearMapping,
}: PrefillEditorProps) {
  const headingId = useId();
  const [pickerFieldKey, setPickerFieldKey] = useState<string>();

  const sections = useMemo(
    () => buildSections(providers, { blueprint, form }),
    [providers, blueprint, form],
  );
  const options = useMemo(() => indexOptions(sections), [sections]);

  const pickerField = form.fields.find((field) => field.key === pickerFieldKey);
  const prefilledCount = form.fields.filter((field) => prefill?.has(field.key)).length;

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-xl border border-slate-200 bg-white"
    >
      <header className="space-y-3 border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id={headingId} className="text-lg font-semibold">
            {form.name}
          </h3>
          <p className="text-sm text-slate-600">
            {prefilledCount} of {form.fields.length} fields prefilled
          </p>
        </div>
        <FormDependencies blueprint={blueprint} form={form} />
      </header>

      {form.fields.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-600">
          This form has no fields to prefill.
        </p>
      ) : (
        <ul aria-label={`Fields of ${form.name}`} className="divide-y divide-slate-100">
          {form.fields.map((field) => {
            const source = prefill?.get(field.key);
            return (
              <PrefillFieldRow
                key={field.key}
                field={field}
                source={source}
                resolved={source && options.get(sourceId(source))}
                onEdit={() => setPickerFieldKey(field.key)}
                onClear={() => onClearMapping(field.key)}
              />
            );
          })}
        </ul>
      )}

      {pickerField && (
        <SourcePickerDialog
          formName={form.name}
          fieldLabel={pickerField.label}
          sections={sections}
          currentSource={prefill?.get(pickerField.key)}
          onSelect={(source) => onSetMapping(pickerField.key, source)}
          onClose={() => setPickerFieldKey(undefined)}
        />
      )}
    </section>
  );
}
