import { useCallback, useState } from 'react';
import { clearMapping, setMapping } from '../domain/mappings';
import type { PrefillMappings, PrefillSource } from '../domain/types';

/**
 * The editable prefill mappings of a blueprint, held in React state. The logic lives in the
 * pure functions of `domain/mappings`; functional updates keep the callbacks stable and free
 * of stale state.
 */
export function usePrefillMappings(initial: PrefillMappings) {
  const [mappings, setMappings] = useState(initial);

  const set = useCallback((formId: string, fieldKey: string, source: PrefillSource) => {
    setMappings((current) => setMapping(current, formId, fieldKey, source));
  }, []);

  const clear = useCallback((formId: string, fieldKey: string) => {
    setMappings((current) => clearMapping(current, formId, fieldKey));
  }, []);

  return { mappings, setMapping: set, clearMapping: clear };
}
