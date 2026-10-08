import { directDependenciesProvider, transitiveDependenciesProvider } from './formDependencies';
import { globalDataProvider } from './globalData';
import type { PrefillSourceProvider } from './types';

/**
 * The prefill sources the editor offers, in the order their sections appear in the picker.
 *
 * This list is the only place that decides which sources exist. Remove an entry to turn a
 * source off, reorder to change the picker, and add a provider to introduce a new source; no
 * component needs to change for any of that. `App` also accepts a different list as a prop.
 */
export const defaultPrefillProviders: readonly PrefillSourceProvider[] = [
  directDependenciesProvider,
  transitiveDependenciesProvider,
  globalDataProvider,
];
