import { normalizeBlueprint } from '../api/normalizeBlueprint';
import type { Blueprint, FormNode } from '../domain/types';
import { mockServerResponse } from './apiFixtures';

/** The mock server's graph as a domain blueprint (forms A–F, see `apiFixtures.ts`). */
export function mockBlueprint(): Blueprint {
  return normalizeBlueprint(mockServerResponse());
}

/** Finds a form by name, failing the test with a clear message if it does not exist. */
export function formNamed(blueprint: Blueprint, name: string): FormNode {
  const form = blueprint.forms.find((candidate) => candidate.name === name);
  if (!form) throw new Error(`The blueprint has no form named "${name}"`);
  return form;
}

interface NodeSpec {
  /** Defaults to "Form <ID>". */
  name?: string;
  /** Field keys. Defaults to `['email', 'name']`. */
  fields?: string[];
  dependsOn?: string[];
  /** Set to false for a node that is part of the graph but is not a form. */
  isForm?: boolean;
}

/**
 * Builds a small domain blueprint without going through the API adapter.
 *
 *   buildBlueprint({ a: {}, b: { dependsOn: ['a'] } })
 */
export function buildBlueprint(nodes: Record<string, NodeSpec>): Blueprint {
  const forms = Object.entries(nodes)
    .filter(([, spec]) => spec.isForm !== false)
    .map(([id, spec]) => ({
      id,
      name: spec.name ?? `Form ${id.toUpperCase()}`,
      definitionId: 'f_shared',
      fields: (spec.fields ?? ['email', 'name']).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        type: 'short-text',
        required: false,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));

  return {
    id: 'bp_test',
    name: 'Test blueprint',
    description: undefined,
    forms,
    dependencies: new Map(Object.entries(nodes).map(([id, spec]) => [id, spec.dependsOn ?? []])),
    prefill: new Map(),
    warnings: [],
  };
}
