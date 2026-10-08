/**
 * Transport types: the parts of the `action-blueprint-graph-get` response this app reads.
 *
 * Names and nullability follow the OpenAPI schema `ActionBlueprintGraphDescription` and the
 * response of the challenge's mock server. Fields the app does not use are left out. Nothing
 * outside `src/api` should import from this file.
 */

export interface BlueprintGraphResponse {
  /**
   * The published schema names these `blueprint_id` / `blueprint_name`; the mock server, an
   * older snapshot, sends `id` / `name`. Both are accepted.
   */
  blueprint_id?: string;
  blueprint_name?: string;
  id?: string;
  name?: string;
  description?: string;
  nodes: ApiNode[] | null;
  edges: ApiEdge[] | null;
  forms: ApiForm[] | null;
}

export interface ApiNode {
  /** Equal to `data.component_key`. Edges and prerequisites refer to nodes by this id. */
  id: string;
  /** "form", "branch", "trigger", … Only "form" nodes carry fields. */
  type: string;
  data: ApiNodeData;
}

export interface ApiNodeData {
  name: string;
  /** For a form node, the id of an entry in the response's `forms` array. */
  component_id: string;
  /** Component keys that must complete first. Mirrors the edges that target this node. */
  prerequisites?: string[] | null;
  /** Input key (a field key, for a form) → expression that produces its value at runtime. */
  input_mapping?: Record<string, ApiExpression> | null;
}

/** `target` depends on `source`: the source must be completed before the target can run. */
export interface ApiEdge {
  source: string;
  target: string;
}

/** A reusable form definition. Several nodes can point at the same one. */
export interface ApiForm {
  id: string;
  field_schema?: ApiFieldSchema | null;
  ui_schema?: ApiUiSchema | null;
}

/** JSON Schema of a form's data; each property is one field. */
export interface ApiFieldSchema {
  properties?: Record<string, ApiFieldProperty> | null;
  required?: string[] | null;
}

export interface ApiFieldProperty {
  avantos_type?: string;
  title?: string;
  type?: string;
}

export interface ApiUiSchema {
  elements?: ApiUiElement[] | null;
}

/** A JSON Forms UI element. `scope` is a pointer such as `#/properties/email`. */
export interface ApiUiElement {
  scope?: string;
  label?: string;
  elements?: ApiUiElement[] | null;
}

/** One of the schema's expression objects, discriminated by `type`. */
export type ApiExpression = { type: string } & Record<string, unknown>;
