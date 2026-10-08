import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildBlueprintGraphUrl,
  fetchBlueprintGraph,
  type BlueprintRequest,
} from '../api/blueprintClient';
import { normalizeBlueprint } from '../api/normalizeBlueprint';
import type { Blueprint } from '../domain/types';

export type BlueprintState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blueprint: Blueprint };

type Outcome = Exclude<BlueprintState, { status: 'loading' }>;

const LOADING: BlueprintState = { status: 'loading' };

/**
 * Loads a blueprint and exposes it as a loading / error / ready state, with a `retry`.
 *
 * The outcome is stored together with the request it belongs to, and "loading" is derived:
 * we are loading whenever the stored outcome is not for the current request. That way a new
 * request never shows the previous one's data and nothing has to be reset by hand.
 */
export function useBlueprint(request: BlueprintRequest): {
  state: BlueprintState;
  retry: () => void;
} {
  const url = buildBlueprintGraphUrl(request);
  const [attempt, setAttempt] = useState(0);
  // A → B → A is a new load, even if B has not settled. Comparing only the URL and attempt
  // would reuse A's old outcome and mount an editor with stale initial mappings.
  const requestKey = useMemo(() => ({ url, attempt }), [url, attempt]);
  const [settled, setSettled] = useState<{ requestKey: typeof requestKey; outcome: Outcome }>();

  useEffect(() => {
    // Aborting on cleanup drops the answer of a request that is no longer current, including
    // the first of the two requests React's StrictMode makes in development.
    const controller = new AbortController();
    const settle = (outcome: Outcome) => {
      if (!controller.signal.aborted) setSettled({ requestKey, outcome });
    };

    fetchBlueprintGraph(url, controller.signal)
      .then((response) => settle({ status: 'ready', blueprint: normalizeBlueprint(response) }))
      .catch((error: unknown) => settle({ status: 'error', message: describe(error) }));

    return () => controller.abort();
  }, [url, requestKey]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const state = settled?.requestKey === requestKey ? settled.outcome : LOADING;
  return { state, retry };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'The blueprint could not be loaded.';
}
