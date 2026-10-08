import { directDependenciesProvider, transitiveDependenciesProvider } from './formDependencies';
import { globalDataProvider } from './globalData';
import type { PrefillSourceProvider } from './types';

/**
 * Every prefill source the app knows, in the default order of their sections in the picker.
 *
 * This list is the only place a source is registered. To add one, write a provider and add it
 * here; no component changes.
 */
export const allPrefillProviders: readonly PrefillSourceProvider[] = [
  directDependenciesProvider,
  transitiveDependenciesProvider,
  globalDataProvider,
];

/**
 * Picks the providers to use by id, in the order the ids are given.
 *
 * This is what makes any combination of sources a matter of configuration: the ids come from
 * `VITE_PREFILL_SOURCES` (see `config.ts`). Without a list, every known provider is used. Ids
 * that match no provider are skipped; `unknownProviderIds` reports them.
 */
export function selectPrefillProviders(
  ids: readonly string[] | undefined,
  known: readonly PrefillSourceProvider[] = allPrefillProviders,
): readonly PrefillSourceProvider[] {
  if (!ids) return known;
  const byId = new Map(known.map((provider) => [provider.id, provider]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

export function unknownProviderIds(
  ids: readonly string[],
  known: readonly PrefillSourceProvider[] = allPrefillProviders,
): string[] {
  return ids.filter((id) => !known.some((provider) => provider.id === id));
}
