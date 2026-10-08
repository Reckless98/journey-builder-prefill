import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiResponse } from '../test/apiFixtures';
import { useBlueprint } from './useBlueprint';

const request = { baseUrl: 'http://api.test', tenantId: '1', blueprintId: 'a' };

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useBlueprint request lifecycle', () => {
  it('aborts the old request and ignores its late result', async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(useBlueprint, { initialProps: request });

    rerender({ ...request, blueprintId: 'b' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await act(async () => {
      second.resolve(Response.json(apiResponse({ name: 'Current' })));
      await second.promise;
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        blueprint: { name: 'Current' },
      }),
    );
    await act(async () => {
      first.resolve(Response.json(apiResponse({ name: 'Stale' })));
      await first.promise;
    });
    expect(result.current.state).toMatchObject({ status: 'ready', blueprint: { name: 'Current' } });
  });

  it('aborts an in-flight request on unmount', () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = renderHook(useBlueprint, { initialProps: request });

    unmount();

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('shows loading when revisiting a URL while the intervening request is pending', async () => {
    const pendingB = deferredResponse();
    const revisitedA = deferredResponse();
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(apiResponse({ name: 'Old A' })))
        .mockReturnValueOnce(pendingB.promise)
        .mockReturnValueOnce(revisitedA.promise),
    );
    const { result, rerender } = renderHook(useBlueprint, { initialProps: request });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    rerender({ ...request, blueprintId: 'b' });
    expect(result.current.state.status).toBe('loading');
    rerender(request);
    expect(result.current.state.status).toBe('loading');

    await act(async () => {
      revisitedA.resolve(Response.json(apiResponse({ name: 'Fresh A' })));
      await revisitedA.promise;
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        blueprint: { name: 'Fresh A' },
      }),
    );
  });
});
