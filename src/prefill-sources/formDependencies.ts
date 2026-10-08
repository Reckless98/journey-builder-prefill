import { getDirectDependencies, getTransitiveDependencies } from '../domain/graph';
import { formFieldSource } from '../domain/mappings';
import type { Blueprint, FormNode } from '../domain/types';
import type { PrefillOptionGroup, PrefillSourceProvider } from './types';

/** The fields of the forms the selected form depends on directly. */
export const directDependenciesProvider: PrefillSourceProvider = {
  id: 'direct-dependencies',
  label: 'Direct dependencies',
  /** Offers fields of existing form nodes reached by one upstream edge. */
  getGroups: ({ blueprint, form }) =>
    formGroups(blueprint, getDirectDependencies(blueprint.dependencies, form.id)),
};

/** The fields of the forms the selected form depends on through other forms. */
export const transitiveDependenciesProvider: PrefillSourceProvider = {
  id: 'transitive-dependencies',
  label: 'Transitive dependencies',
  /** Offers upstream form fields beyond the direct dependencies, traversing non-form nodes too. */
  getGroups: ({ blueprint, form }) =>
    formGroups(blueprint, getTransitiveDependencies(blueprint.dependencies, form.id)),
};

/**
 * One group per form among `nodeIds`, in the blueprint's form order (by name). Ids of nodes
 * that are not forms have no fields to offer and produce no group.
 */
function formGroups(blueprint: Blueprint, nodeIds: string[]): PrefillOptionGroup[] {
  const wanted = new Set(nodeIds);
  return blueprint.forms.filter((form) => wanted.has(form.id)).map(toGroup);
}

/** Uses the node id as the source owner, so nodes sharing a definition remain distinct. */
function toGroup(form: FormNode): PrefillOptionGroup {
  return {
    id: form.id,
    label: form.name,
    options: form.fields.map((field) => ({
      source: formFieldSource(form.id, field.key),
      label: field.label,
      valueType: field.type,
    })),
  };
}
