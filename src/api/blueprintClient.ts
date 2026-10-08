import type { BlueprintGraphResponse } from './types';
import { isBlueprintGraphResponse } from './validateBlueprint';

export interface BlueprintRequest {
  baseUrl: string;
  tenantId: string;
  blueprintId: string;
  /**
   * The published API has this path segment; the challenge's mock server does not and answers
   * 404 when it is present. Leave undefined for the mock server.
   */
  blueprintVersionId?: string;
}

export function buildBlueprintGraphUrl(request: BlueprintRequest): string {
  const { baseUrl, tenantId, blueprintId, blueprintVersionId } = request;
  const segments = [
    'api',
    'v1',
    tenantId,
    'actions',
    'blueprints',
    blueprintId,
    ...(blueprintVersionId ? [blueprintVersionId] : []),
    'graph',
  ];
  return `${baseUrl.replace(/\/+$/, '')}/${segments.map(encodeURIComponent).join('/')}`;
}

/**
 * Fetches the blueprint graph. Rejects with an `Error` whose message is fit to show to a user
 * when the server cannot be reached, answers with an error status, or returns something that
 * is not a blueprint graph.
 */
export async function fetchBlueprintGraph(
  url: string,
  signal?: AbortSignal,
): Promise<BlueprintGraphResponse> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`Could not reach the API at ${url}. Is the server running?`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`The API responded with ${response.status} ${response.statusText}`.trim());
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!isBlueprintGraphResponse(body)) {
    throw new Error('The API response is not a blueprint graph.');
  }
  return body;
}
