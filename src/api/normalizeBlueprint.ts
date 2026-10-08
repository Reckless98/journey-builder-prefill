import { formFieldSource } from '../domain/mappings';
import type {
  Blueprint,
  DependencyMap,
  FormField,
  FormNode,
  FormPrefill,
  PrefillSource,
} from '../domain/types';
import type {
  ApiEdge,
  ApiExpression,
  ApiForm,
  ApiNode,
  ApiUiElement,
  BlueprintGraphResponse,
} from './types';

const FORM_NODE_TYPE = 'form';

/**
 * The adapter between the API and the app: turns a raw graph response into the domain model.
 *
 * After structural validation, invalid edges, target mappings and unsupported expressions
 * are skipped with warnings. Missing definitions stay visible without fields; stale source
 * references are retained so the editor can flag them as unavailable and offer a repair.
 */
export function normalizeBlueprint(response: BlueprintGraphResponse): Blueprint {
  const warnings: string[] = [];
  const nodes = uniqueNodes(response.nodes ?? [], warnings);
  const definitions = new Map((response.forms ?? []).map((form) => [form.id, form]));

  const forms: FormNode[] = [];
  const prefill = new Map<string, FormPrefill>();
  for (const node of nodes) {
    if (node.type !== FORM_NODE_TYPE) continue;
    const form = toFormNode(node, definitions, warnings);
    forms.push(form);
    const formPrefill = toFormPrefill(node, form, warnings);
    if (formPrefill.size > 0) prefill.set(form.id, formPrefill);
  }
  // The API returns nodes in no meaningful order, so impose a stable, readable one.
  forms.sort(
    (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id),
  );

  const dependencies = toDependencyMap(nodes, response.edges ?? [], warnings);
  const description = response.description?.trim();

  return {
    id: response.blueprint_id ?? response.id ?? '',
    name: response.blueprint_name ?? response.name ?? 'Untitled blueprint',
    description: description === '' ? undefined : description,
    forms,
    dependencies,
    prefill,
    // Repeating an identical note adds nothing, and the UI lists them by their text.
    warnings: [...new Set(warnings)],
  };
}

/** Keeps the first occurrence of each node id and records every discarded duplicate. */
function uniqueNodes(nodes: ApiNode[], warnings: string[]): ApiNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      return true;
    }
    warnings.push(`Ignored a second node with the id "${node.id}".`);
    return false;
  });
}

/**
 * Builds the dependency map from the edges. An edge `source → target` means `target` depends on
 * `source`, which the mock data confirms: each node's `prerequisites` are exactly the sources
 * of the edges that target it.
 */
function toDependencyMap(nodes: ApiNode[], edges: ApiEdge[], warnings: string[]): DependencyMap {
  const dependencies = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const { source, target } of edges) {
    const targetDependencies = dependencies.get(target);
    if (!targetDependencies || !dependencies.has(source)) {
      warnings.push(
        `Ignored the dependency "${source}" → "${target}": it refers to a node that is not in the blueprint.`,
      );
      continue;
    }
    if (source !== target && !targetDependencies.includes(source)) targetDependencies.push(source);
  }
  return dependencies;
}

/** Joins a node to its reusable definition; a missing definition leaves a visible empty form. */
function toFormNode(
  node: ApiNode,
  definitions: ReadonlyMap<string, ApiForm>,
  warnings: string[],
): FormNode {
  const definition = definitions.get(node.data.component_id);
  if (!definition) {
    warnings.push(
      `"${node.data.name}" uses the form definition "${node.data.component_id}", which is not in the response. It is shown without fields.`,
    );
  }
  return {
    id: node.id,
    name: node.data.name,
    definitionId: node.data.component_id,
    fields: definition ? toFields(definition) : [],
  };
}

/** Extracts top-level fields, required flags, and title → UI-label → key label fallbacks. */
function toFields(definition: ApiForm): FormField[] {
  const schema = definition.field_schema;
  const required = new Set(schema?.required ?? []);
  const uiLabels = collectUiLabels(definition.ui_schema?.elements);

  // Fields keep the order of the schema's properties.
  return Object.entries(schema?.properties ?? {}).map(([key, property]) => ({
    key,
    label: property.title ?? uiLabels.get(key) ?? key,
    type: property.avantos_type ?? schemaTypeLabel(property.type),
    required: required.has(key),
  }));
}

/** Makes a display hint from JSON Schema types; missing or empty type lists become unknown. */
function schemaTypeLabel(type: string | string[] | undefined): string {
  const names = type === undefined ? [] : [type].flat();
  return names.length > 0 ? names.join(' | ') : 'unknown';
}

/** Field key → label from the UI schema, used for fields whose schema property has no title. */
function collectUiLabels(
  elements: ApiUiElement[] | null | undefined,
  labels = new Map<string, string>(),
): Map<string, string> {
  for (const element of elements ?? []) {
    const key = fieldKeyFromScope(element.scope);
    if (key !== undefined && element.label) labels.set(key, element.label);
    collectUiLabels(element.elements, labels);
  }
  return labels;
}

/**
 * Resolves a fragment pointing to one top-level property, including an empty property key.
 * URI decoding precedes JSON Pointer decoding; nested paths and malformed URI escapes are ignored.
 */
function fieldKeyFromScope(scope: string | undefined): string | undefined {
  if (!scope?.startsWith('#')) return undefined;
  try {
    // Decode the URI fragment once, then resolve its single top-level property token.
    const pointer = decodeURIComponent(scope.slice(1));
    const token = /^\/properties\/([^/]*)$/.exec(pointer)?.[1];
    // Decode ~1 before ~0 so ~01 stays literal ~1.
    return token?.replace(/~1/g, '/').replace(/~0/g, '~');
  } catch {
    // Invalid percent escapes or UTF-8 cannot identify a field; retain its schema label.
    return undefined;
  }
}

/**
 * Imports supported expressions for existing target fields and warns about other mappings.
 * Source availability is checked later by providers, so stale sources remain repairable.
 */
function toFormPrefill(node: ApiNode, form: FormNode, warnings: string[]): FormPrefill {
  const fieldKeys = new Set(form.fields.map((field) => field.key));
  const formPrefill = new Map<string, PrefillSource>();

  for (const [fieldKey, expression] of Object.entries(node.data.input_mapping ?? {})) {
    if (!fieldKeys.has(fieldKey)) {
      warnings.push(`"${form.name}" has an input mapping for "${fieldKey}", which is not a field.`);
      continue;
    }
    const source = toPrefillSource(expression);
    if (!source) {
      warnings.push(
        `"${form.name}" maps "${fieldKey}" with a "${expression.type}" expression, which this editor does not handle. It is not shown.`,
      );
      continue;
    }
    formPrefill.set(fieldKey, source);
  }
  return formPrefill;
}

/**
 * Reads one `input_mapping` expression as a prefill source.
 *
 * The schema allows more than thirty expression types here and the mock data contains none, so
 * only the type that unambiguously addresses a value of another component is interpreted:
 * `action_component_data`, with `component_key` and `output_key`. Whether that source is still
 * upstream of the form is decided later, against the graph.
 */
function toPrefillSource(expression: ApiExpression): PrefillSource | undefined {
  const { type, component_key: nodeId, output_key: fieldKey, is_metadata: isMetadata } = expression;
  if (type !== 'action_component_data' || isMetadata === true) return undefined;
  if (typeof nodeId !== 'string' || typeof fieldKey !== 'string') return undefined;
  return formFieldSource(nodeId, fieldKey);
}
