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
 * The outcome is stored with the request it belongs to and "loading" is derived: the hook is
 * loading whenever the stored outcome is not for the current request. A new request therefore
 * never shows the previous one's data, and nothing is reset by hand.
 */
export function useBlueprint(request: BlueprintRequest): {
  state: BlueprintState;
  retry: () => void;
} {
  const url = buildBlueprintGraphUrl(request);
  const [attempt, setAttempt] = useState(0);
  // A new object for every URL or attempt change. Comparing by value would treat A → B → A as
  // the original A and reuse its outcome while the new load is still pending.
  const requestKey = useMemo(() => ({ url, attempt }), [url, attempt]);
  const [settled, setSettled] = useState<{ requestKey: typeof requestKey; outcome: Outcome }>();

  useEffect(() => {
    // Aborting on cleanup drops the answer of a request that is no longer current, including
    // the first of the two requests React's StrictMode makes in development.
    const controller = new AbortController();
    // Cleanup invalidates this closure even if a transport delivers a response after abort.
    const settle = (outcome: Outcome) => {
      if (!controller.signal.aborted) setSettled({ requestKey, outcome });
    };

    fetchBlueprintGraph(url, controller.signal)
      .then((response) => settle({ status: 'ready', blueprint: normalizeBlueprint(response) }))
      .catch((error: unknown) => settle({ status: 'error', message: describe(error) }));

    return () => controller.abort();
  }, [url, requestKey]);

  // A new attempt creates a new request identity even when the URL stays the same.
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const state = settled?.requestKey === requestKey ? settled.outcome : LOADING;
  return { state, retry };
}

/** Converts caught unknown values into readable UI text without assuming they are Errors. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'The blueprint could not be loaded.';
}
