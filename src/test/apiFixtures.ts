import type { ApiForm, ApiNode, ApiNodeData, BlueprintGraphResponse } from '../api/types';
import mockServerGraph from './fixtures/mock-server-graph.json';

/**
 * The response of the challenge's mock server: `fixtures/mock-server-graph.json` is a verbatim
 * copy of `graph.json` from mosaic-avantos/frontendchallengeserver.
 *
 *   A ──► B ──► D ──┐
 *   │               ├──► F
 *   └───► C ──► E ──┘
 */
export function mockServerResponse(): BlueprintGraphResponse {
  return structuredClone(mockServerGraph);
}

/** Node ids of the forms in the mock server's graph. */
export const MOCK_FORM_ID = {
  A: 'form-47c61d17-62b0-4c42-8ca2-0eff641c9d88',
  B: 'form-a4750667-d774-40fb-9b0a-44f8539ff6c4',
  C: 'form-7c26f280-7bff-40e3-b9a5-0533136f52c3',
  D: 'form-0f58384c-4966-4ce6-9ec2-40b96d61f745',
  E: 'form-e15d42df-c7c0-4819-9391-53730e6d47b3',
  F: 'form-bad163fd-09bd-4710-ad80-245f31b797d5',
} as const;

/** A raw response with only the given parts filled in. */
export function apiResponse(parts: Partial<BlueprintGraphResponse> = {}): BlueprintGraphResponse {
  return { name: 'Test blueprint', nodes: [], edges: [], forms: [], ...parts };
}

/** A raw form definition whose fields are short-text inputs titled after their keys. */
export function apiForm(id: string, fieldKeys: string[] = ['email', 'name']): ApiForm {
  return {
    id,
    name: `${id} definition`,
    field_schema: {
      properties: Object.fromEntries(
        fieldKeys.map((key) => [key, { avantos_type: 'short-text', title: key, type: 'string' }]),
      ),
      required: [],
    },
  };
}

/** A raw node. `definitionId` should match an `apiForm` in the same response. */
export function apiNode(
  id: string,
  name: string,
  definitionId = 'f_default',
  data: Partial<ApiNodeData> = {},
  type = 'form',
): ApiNode {
  return { id, type, data: { name, component_id: definitionId, input_mapping: {}, ...data } };
}
