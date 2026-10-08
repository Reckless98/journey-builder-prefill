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
 * After the client validates the response structure, references that do not resolve are
 * dropped and described in `warnings`, so one bad edge or mapping cannot take the editor down.
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
    const token = /^#\/properties\/([^/]+)$/.exec(element.scope ?? '')?.[1];
    // JSON Pointer escapes one property token: decode ~1 before ~0 so ~01 stays literal ~1.
    const key = token?.replace(/~1/g, '/').replace(/~0/g, '~');
    if (key && element.label) labels.set(key, element.label);
    collectUiLabels(element.elements, labels);
  }
  return labels;
}

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
