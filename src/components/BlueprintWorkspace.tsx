import { useState } from 'react';
import type { Blueprint } from '../domain/types';
import { usePrefillMappings } from '../hooks/usePrefillMappings';
import type { PrefillSourceProvider } from '../prefill-sources/types';
import { FormList } from './FormList';
import { PrefillEditor } from './PrefillEditor';
import { StatusPanel } from './StatusPanel';

interface BlueprintWorkspaceProps {
  blueprint: Blueprint;
  providers: readonly PrefillSourceProvider[];
}

/**
 * A loaded blueprint: the form list next to the prefill editor of the selected form.
 *
 * Owns the two pieces of state the screen has, which form is selected and the edited mappings.
 * It is only mounted once a blueprint has loaded, so both can start from the blueprint without
 * any effect to keep them in sync.
 */
export function BlueprintWorkspace({ blueprint, providers }: BlueprintWorkspaceProps) {
  const { mappings, setMapping, clearMapping } = usePrefillMappings(blueprint.prefill);
  const [selectedFormId, setSelectedFormId] = useState<string>();

  // Derived rather than stored: falls back to the first form until the user picks one.
  const selectedForm =
    blueprint.forms.find((form) => form.id === selectedFormId) ?? blueprint.forms[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{blueprint.name}</h2>
        {blueprint.description && (
          <p className="mt-1 text-sm text-slate-600">{blueprint.description}</p>
        )}
      </div>

      {blueprint.warnings.length > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            {blueprint.warnings.length === 1
              ? '1 part of this blueprint could not be used'
              : `${blueprint.warnings.length} parts of this blueprint could not be used`}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blueprint.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}

      {selectedForm ? (
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <FormList
            forms={blueprint.forms}
            selectedFormId={selectedForm.id}
            mappings={mappings}
            onSelect={setSelectedFormId}
          />
          <PrefillEditor
            key={selectedForm.id}
            blueprint={blueprint}
            form={selectedForm}
            providers={providers}
            prefill={mappings.get(selectedForm.id)}
            onSetMapping={(fieldKey, source) => setMapping(selectedForm.id, fieldKey, source)}
            onClearMapping={(fieldKey) => clearMapping(selectedForm.id, fieldKey)}
          />
        </div>
      ) : (
        <StatusPanel title="This blueprint has no forms">
          Once forms are added to the blueprint, their prefill configuration appears here.
        </StatusPanel>
      )}
    </div>
  );
}
