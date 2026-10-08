import type { BlueprintGraphResponse } from './types';

type Check = (value: unknown) => boolean;

/** Narrows an unknown JSON value to an object whose properties can safely be inspected. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks primitive strings without coercing numbers, null, or other JSON values. */
const isString: Check = (value) => typeof value === 'string';
/** Allows an omitted string property, but rejects an explicitly null value. */
const optionalString: Check = (value) => value === undefined || isString(value);
/** Accepts the JSON Schema type forms this adapter reads: a string or a string array. */
const optionalTypeNames: Check = (value) =>
  optionalString(value) || (Array.isArray(value) && value.every(isString));

/** Validates every array element; null represents an empty collection in the API. */
function nullableArray(value: unknown, check: Check): boolean {
  return value === null || (Array.isArray(value) && value.every(check));
}

/** Also permits an omitted nested array, whose normalization fallback is empty. */
function optionalArray(value: unknown, check: Check): boolean {
  return value === undefined || nullableArray(value, check);
}

/** Validates all values of an optional dictionary, allowing both omission and null. */
function optionalRecord(value: unknown, check: Check): boolean {
  return (
    value === undefined || value === null || (isRecord(value) && Object.values(value).every(check))
  );
}

/** Requires an expression discriminator; the adapter decides which payloads it understands. */
function isExpression(value: unknown): boolean {
  return isRecord(value) && isString(value.type);
}

/** Checks node identity and the nested data read even for non-form graph nodes. */
function isNode(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !isString(value.type)) return false;
  const data = value.data;
  return (
    isRecord(data) &&
    isString(data.name) &&
    isString(data.component_id) &&
    optionalArray(data.prerequisites, isString) &&
    optionalRecord(data.input_mapping, isExpression)
  );
}

/** Checks edge endpoint types; reference existence is handled during normalization. */
function isEdge(value: unknown): boolean {
  return isRecord(value) && isString(value.source) && isString(value.target);
}

/** Validates field label/type hints without claiming to validate the whole JSON Schema. */
function isFieldProperty(value: unknown): boolean {
  return (
    isRecord(value) &&
    [value.title, value.avantos_type].every(optionalString) &&
    optionalTypeNames(value.type)
  );
}

/** Checks the properties dictionary and required-field names used to build field rows. */
function isFieldSchema(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) &&
      optionalRecord(value.properties, isFieldProperty) &&
      optionalArray(value.required, isString))
  );
}

/** Recursively validates UI-schema label scopes and nested layout elements. */
function isUiElement(value: unknown): boolean {
  return (
    isRecord(value) &&
    optionalString(value.scope) &&
    optionalString(value.label) &&
    optionalArray(value.elements, isUiElement)
  );
}

/** Allows absent UI metadata, or a layout tree whose readable elements are valid. */
function isUiSchema(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) && optionalArray(value.elements, isUiElement))
  );
}

/** Validates a reusable form definition, distinct from a graph node that references it. */
function isForm(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFieldSchema(value.field_schema) &&
    isUiSchema(value.ui_schema)
  );
}

/**
 * Validates the shapes the adapter reads, including nested fields and expressions.
 * Unknown keys are allowed; unresolved references and unsupported expression types remain
 * the adapter's responsibility. Invalid structure fails the load with a readable retry state.
 * This is not a validator for the entire published API contract.
 */
export function isBlueprintGraphResponse(value: unknown): value is BlueprintGraphResponse {
  return (
    isRecord(value) &&
    [value.id, value.name, value.blueprint_id, value.blueprint_name, value.description].every(
      optionalString,
    ) &&
    nullableArray(value.nodes, isNode) &&
    nullableArray(value.edges, isEdge) &&
    nullableArray(value.forms, isForm)
  );
}
