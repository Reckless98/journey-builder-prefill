import type { BlueprintRequest } from './api/blueprintClient';
import {
  allPrefillProviders,
  selectPrefillProviders,
  unknownProviderIds,
} from './prefill-sources/registry';

/**
 * Everything the app takes from the environment. See `.env.example` for the variables.
 */

const env = import.meta.env;

/** A variable that is unset or blank counts as not provided. */
function provided(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Which blueprint to load. The defaults target the challenge's mock server, which ignores the
 * tenant and blueprint ids and always returns the same graph.
 */
export const blueprintRequest: BlueprintRequest = {
  baseUrl: provided(env.VITE_API_BASE_URL) ?? 'http://localhost:3000',
  tenantId: provided(env.VITE_TENANT_ID) ?? '1',
  blueprintId: provided(env.VITE_BLUEPRINT_ID) ?? 'bp_01jk766tckfwx84xjcxazggzyc',
  blueprintVersionId: provided(env.VITE_BLUEPRINT_VERSION_ID),
};

/** Splits a comma-separated list of provider ids. Undefined when the variable is not set. */
export function parseProviderIds(value: string | undefined): string[] | undefined {
  return provided(value)
    ?.split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
}

const providerIds = parseProviderIds(env.VITE_PREFILL_SOURCES);

if (providerIds) {
  const unknown = unknownProviderIds(providerIds);
  if (unknown.length > 0) {
    console.warn(
      `VITE_PREFILL_SOURCES names unknown prefill sources: ${unknown.join(', ')}. ` +
        `Known sources: ${allPrefillProviders.map((provider) => provider.id).join(', ')}.`,
    );
  }
}

/** The prefill sources to offer: all of them, or the selection in `VITE_PREFILL_SOURCES`. */
export const prefillProviders = selectPrefillProviders(providerIds);
