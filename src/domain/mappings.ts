import type { PrefillMappings, PrefillSource } from './types';

/** Source `type` for a field of another form in the blueprint. */
export const FORM_FIELD_SOURCE = 'form_field';

/** The source "field `fieldKey` of the form node `nodeId`". */
export function formFieldSource(nodeId: string, fieldKey: string): PrefillSource {
  return { type: FORM_FIELD_SOURCE, ownerId: nodeId, key: fieldKey };
}

/**
 * A stable string identity for a source, usable as a map key or React key.
 *
 * Two sources share an id only when all three parts are equal. JSON encoding rather than
 * joining with a separator means no choice of characters inside the parts can make two
 * different sources collide.
 */
export function sourceId(source: PrefillSource): string {
  return JSON.stringify([source.type, source.ownerId, source.key]);
}

export function getMapping(
  mappings: PrefillMappings,
  formId: string,
  fieldKey: string,
): PrefillSource | undefined {
  return mappings.get(formId)?.get(fieldKey);
}

/**
 * Returns new mappings in which `fieldKey` of `formId` is prefilled from `source`, replacing
 * any previous source. The input is not modified and other forms keep their identity.
 */
export function setMapping(
  mappings: PrefillMappings,
  formId: string,
  fieldKey: string,
  source: PrefillSource,
): PrefillMappings {
  const formPrefill = new Map(mappings.get(formId));
  formPrefill.set(fieldKey, source);
  return new Map(mappings).set(formId, formPrefill);
}

/**
 * Returns new mappings in which `fieldKey` of `formId` is no longer prefilled. When there is
 * nothing to clear the same object is returned, so callers can rely on identity.
 */
export function clearMapping(
  mappings: PrefillMappings,
  formId: string,
  fieldKey: string,
): PrefillMappings {
  const current = mappings.get(formId);
  if (!current?.has(fieldKey)) return mappings;

  const formPrefill = new Map(current);
  formPrefill.delete(fieldKey);

  const next = new Map(mappings);
  if (formPrefill.size === 0) next.delete(formId);
  else next.set(formId, formPrefill);
  return next;
}
