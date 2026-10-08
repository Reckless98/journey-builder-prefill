import type { BlueprintRequest } from './api/blueprintClient';

const env = import.meta.env;

/** A variable that is unset or blank counts as not provided. */
function provided(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Which blueprint to load. The defaults target the challenge's mock server, which ignores the
 * tenant and blueprint ids and always returns the same graph. Override with `VITE_*` variables
 * (see `.env.example`).
 */
export const blueprintRequest: BlueprintRequest = {
  baseUrl: provided(env.VITE_API_BASE_URL) ?? 'http://localhost:3000',
  tenantId: provided(env.VITE_TENANT_ID) ?? '1',
  blueprintId: provided(env.VITE_BLUEPRINT_ID) ?? 'bp_01jk766tckfwx84xjcxazggzyc',
  blueprintVersionId: provided(env.VITE_BLUEPRINT_VERSION_ID),
};
