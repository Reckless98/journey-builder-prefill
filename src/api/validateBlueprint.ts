import type { BlueprintGraphResponse } from './types';

type Check = (value: unknown) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString: Check = (value) => typeof value === 'string';
const optionalString: Check = (value) => value === undefined || isString(value);
const optionalTypeNames: Check = (value) =>
  optionalString(value) || (Array.isArray(value) && value.every(isString));

function nullableArray(value: unknown, check: Check): boolean {
  return value === null || (Array.isArray(value) && value.every(check));
}

function optionalArray(value: unknown, check: Check): boolean {
  return value === undefined || nullableArray(value, check);
}

function optionalRecord(value: unknown, check: Check): boolean {
  return (
    value === undefined || value === null || (isRecord(value) && Object.values(value).every(check))
  );
}

function isExpression(value: unknown): boolean {
  return isRecord(value) && isString(value.type);
}

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

function isEdge(value: unknown): boolean {
  return isRecord(value) && isString(value.source) && isString(value.target);
}

function isFieldProperty(value: unknown): boolean {
  return (
    isRecord(value) &&
    [value.title, value.avantos_type].every(optionalString) &&
    optionalTypeNames(value.type)
  );
}

function isFieldSchema(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) &&
      optionalRecord(value.properties, isFieldProperty) &&
      optionalArray(value.required, isString))
  );
}

function isUiElement(value: unknown): boolean {
  return (
    isRecord(value) &&
    optionalString(value.scope) &&
    optionalString(value.label) &&
    optionalArray(value.elements, isUiElement)
  );
}

function isUiSchema(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) && optionalArray(value.elements, isUiElement))
  );
}

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
