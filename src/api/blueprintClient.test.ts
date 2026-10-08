import { describe, expect, it, vi } from 'vitest';
import { apiResponse } from '../test/apiFixtures';
import { buildBlueprintGraphUrl, fetchBlueprintGraph } from './blueprintClient';

const request = { baseUrl: 'http://localhost:3000', tenantId: '1', blueprintId: 'bp_1' };
const url = 'http://localhost:3000/api/v1/1/actions/blueprints/bp_1/graph';

function stubFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('buildBlueprintGraphUrl', () => {
  it('builds the path the mock server serves', () => {
    expect(buildBlueprintGraphUrl(request)).toBe(url);
  });

  it('adds the version segment of the published API when one is given', () => {
    expect(buildBlueprintGraphUrl({ ...request, blueprintVersionId: 'bpv_2' })).toBe(
      'http://localhost:3000/api/v1/1/actions/blueprints/bp_1/bpv_2/graph',
    );
  });

  it('tolerates a trailing slash on the base URL', () => {
    expect(buildBlueprintGraphUrl({ ...request, baseUrl: 'http://localhost:3000/' })).toBe(url);
  });

  it('encodes path parameters', () => {
    expect(buildBlueprintGraphUrl({ ...request, tenantId: 'a/b', blueprintId: 'x y' })).toBe(
      'http://localhost:3000/api/v1/a%2Fb/actions/blueprints/x%20y/graph',
    );
  });
});

describe('fetchBlueprintGraph', () => {
  it('returns the parsed body of a successful response', async () => {
    const body = apiResponse({ name: 'Loaded' });
    const fetchMock = stubFetch(() => Promise.resolve(Response.json(body)));
    const { signal } = new AbortController();

    await expect(fetchBlueprintGraph(url, signal)).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(url, { signal });
  });

  it('rejects with the status when the server answers with an error', async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json({ error: 'Resource not found!' }, { status: 404, statusText: 'Not Found' }),
      ),
    );

    await expect(fetchBlueprintGraph(url)).rejects.toThrow('The API responded with 404 Not Found');
  });

  it('rejects with a readable message when the server cannot be reached', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(fetchBlueprintGraph(url)).rejects.toThrow(`Could not reach the API at ${url}`);
  });

  it('rejects a successful response that is not JSON', async () => {
    stubFetch(() => Promise.resolve(new Response('<html></html>')));

    await expect(fetchBlueprintGraph(url)).rejects.toThrow('not a blueprint graph');
  });

  it.each([
    ['an error object', { error: 'nope' }],
    ['a body with a non-array collection', { nodes: {}, edges: [], forms: [] }],
    ['null', null],
  ])('rejects a successful response that is %s', async (_, body) => {
    stubFetch(() => Promise.resolve(Response.json(body)));

    await expect(fetchBlueprintGraph(url)).rejects.toThrow('not a blueprint graph');
  });

  it('accepts null collections, which the schema allows', async () => {
    const body = { nodes: null, edges: null, forms: null };
    stubFetch(() => Promise.resolve(Response.json(body)));

    await expect(fetchBlueprintGraph(url)).resolves.toEqual(body);
  });

  it('lets an abort through unchanged so callers can tell it from a failure', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    stubFetch(() => Promise.reject(abortError));
    controller.abort();

    await expect(fetchBlueprintGraph(url, controller.signal)).rejects.toBe(abortError);
  });
});
