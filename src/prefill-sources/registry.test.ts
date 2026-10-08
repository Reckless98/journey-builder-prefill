import { describe, expect, it } from 'vitest';
import { allPrefillProviders, selectPrefillProviders, unknownProviderIds } from './registry';

const ids = (providers: readonly { id: string }[]) => providers.map((provider) => provider.id);

describe('allPrefillProviders', () => {
  it('registers the three built-in sources under unique ids', () => {
    expect(ids(allPrefillProviders)).toEqual([
      'direct-dependencies',
      'transitive-dependencies',
      'global-data',
    ]);
  });
});

describe('selectPrefillProviders', () => {
  it('uses every provider when no selection is configured', () => {
    expect(selectPrefillProviders(undefined)).toBe(allPrefillProviders);
  });

  it.each([
    [['global-data']],
    [['direct-dependencies', 'global-data']],
    [['global-data', 'transitive-dependencies', 'direct-dependencies']],
    [[]],
  ])('uses exactly the providers named by %j, in that order', (selection) => {
    expect(ids(selectPrefillProviders(selection))).toEqual(selection);
  });

  it('skips ids that match no provider and uses a repeated id once', () => {
    const selection = ['global-data', 'nope', 'global-data'];

    expect(ids(selectPrefillProviders(selection))).toEqual(['global-data']);
    expect(unknownProviderIds(selection)).toEqual(['nope']);
  });

  it('selects among any list of providers, such as one with a custom source', () => {
    const custom = { id: 'custom', label: 'Custom', getGroups: () => [] };
    const known = [...allPrefillProviders, custom];

    expect(ids(selectPrefillProviders(['custom', 'global-data'], known))).toEqual([
      'custom',
      'global-data',
    ]);
    expect(unknownProviderIds(['custom'], known)).toEqual([]);
  });
});
