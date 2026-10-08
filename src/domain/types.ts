/**
 * Domain model for the prefill editor. `src/api/normalizeBlueprint.ts` converts the raw API
 * response into these types once; nothing outside `src/api` sees the raw shapes.
 */

/** A single input on a form. */
export interface FormField {
  /** Property key in the form's field schema. Unique within one form, not across forms. */
  key: string;
  label: string;
  /** Avantos field type such as "short-text". Shown as a hint. */
  type: string;
  required: boolean;
}

/** A form placed in the blueprint graph. */
export interface FormNode {
  /**
   * Node id (the API's `component_key`). Unique within a blueprint, and the only form
   * identity the app uses.
   */
  id: string;
  name: string;
  /**
   * The reusable form definition this node renders. Several nodes can share one definition,
   * so this must never be used to tell forms apart.
   */
  definitionId: string;
  fields: readonly FormField[];
}

/**
 * Node id → ids of the nodes it directly depends on.
 *
 * Every node of the blueprint has an entry (possibly empty), including nodes that are not forms,
 * so a dependency chain that passes through one is still followed.
 */
export type DependencyMap = ReadonlyMap<string, readonly string[]>;

/**
 * A serialisable pointer to one value that can prefill a field: the value named `key` on the
 * thing `ownerId` of kind `type`. Open-ended, so a new provider can introduce its own `type`.
 *
 * Examples: `{ type: 'form_field', ownerId: <node id>, key: 'email' }`,
 * `{ type: 'global', ownerId: 'client_organization', key: 'name' }`.
 */
export interface PrefillSource {
  type: string;
  ownerId: string;
  key: string;
}

/** Field key → the source that prefills it. Fields without an entry are not prefilled. */
export type FormPrefill = ReadonlyMap<string, PrefillSource>;

/** Form node id → that form's prefill configuration. */
export type PrefillMappings = ReadonlyMap<string, FormPrefill>;

export interface Blueprint {
  id: string;
  name: string;
  description: string | undefined;
  /** Form nodes, sorted by name. */
  forms: readonly FormNode[];
  dependencies: DependencyMap;
  /** Prefill mappings already stored on the blueprint when it was loaded. */
  prefill: PrefillMappings;
  /** Human-readable notes about data that was skipped or could not be interpreted. */
  warnings: readonly string[];
}
