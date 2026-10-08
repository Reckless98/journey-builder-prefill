import { describe, expect, it } from 'vitest';
import { formFieldSource, sourceId } from '../domain/mappings';
import { MOCK_FORM_ID } from '../test/apiFixtures';
import { formNamed, mockBlueprint } from '../test/builders';
import { directDependenciesProvider, transitiveDependenciesProvider } from './formDependencies';
import { globalDataProvider, globalSource } from './globalData';
import { allPrefillProviders } from './registry';
import { buildSections, filterSections, indexOptions, type PrefillSection } from './sections';
import type { PrefillSourceProvider } from './types';

const blueprint = mockBlueprint();
const contextFor = (formName: string) => ({ blueprint, form: formNamed(blueprint, formName) });

const sectionLabels = (sections: readonly PrefillSection[]) =>
  sections.map((section) => section.label);
const groupLabels = (sections: readonly PrefillSection[]) =>
  sections.flatMap((section) => section.groups.map((group) => group.label));
const optionLabels = (sections: readonly PrefillSection[]) =>
  sections.flatMap((section) =>
    section.groups.flatMap((group) => group.options.map((option) => option.label)),
  );

/** A source the built-in providers know nothing about, as a future extension would add. */
const teamProvider: PrefillSourceProvider = {
  id: 'team',
  label: 'Team',
  getGroups: ({ form }) => [
    {
      id: 'owner',
      label: `Owner of ${form.name}`,
      options: [
        { source: { type: 'team_member', ownerId: 'owner', key: 'email' }, label: 'Email' },
      ],
    },
  ],
};

describe('buildSections', () => {
  it('returns one section per default provider, in registry order', () => {
    const sections = buildSections(allPrefillProviders, contextFor('Form D'));

    expect(sectionLabels(sections)).toEqual([
      'Direct dependencies',
      'Transitive dependencies',
      'Global data',
    ]);
    expect(groupLabels(sections)).toEqual([
      'Form B',
      'Form A',
      'Action Properties',
      'Client Organization Properties',
    ]);
  });

  it.each([
    ['only global data', [globalDataProvider], ['Global data']],
    ['only direct dependencies', [directDependenciesProvider], ['Direct dependencies']],
    [
      'global data before transitive dependencies',
      [globalDataProvider, transitiveDependenciesProvider],
      ['Global data', 'Transitive dependencies'],
    ],
    ['no providers at all', [], []],
  ])('supports %s', (_, providers, expected) => {
    expect(sectionLabels(buildSections(providers, contextFor('Form D')))).toEqual(expected);
  });

  it('includes a provider it has never seen without any other change', () => {
    const sections = buildSections([...allPrefillProviders, teamProvider], contextFor('Form D'));

    expect(sectionLabels(sections)).toContain('Team');
    expect(groupLabels(sections)).toContain('Owner of Form D');
  });

  it('keeps the section of a provider that has nothing to offer, with no groups', () => {
    const [direct, transitive] = buildSections(allPrefillProviders, contextFor('Form A'));

    expect(direct).toMatchObject({ providerId: 'direct-dependencies', groups: [] });
    expect(transitive).toMatchObject({ providerId: 'transitive-dependencies', groups: [] });
  });

  it('drops groups that have no options', () => {
    const emptyGroupProvider: PrefillSourceProvider = {
      id: 'empty',
      label: 'Empty',
      getGroups: () => [{ id: 'nothing', label: 'Nothing here', options: [] }],
    };

    expect(buildSections([emptyGroupProvider], contextFor('Form D'))[0]?.groups).toEqual([]);
  });

  it('offers a source once, under the first provider that returns it', () => {
    const copy = { ...directDependenciesProvider, id: 'copy', label: 'Copy' };
    const [first, second] = buildSections([directDependenciesProvider, copy], contextFor('Form D'));

    expect(first?.groups[0]?.options).toHaveLength(8);
    expect(second?.groups).toEqual([]);
  });

  it('filters stale form-field favorites from a fourth provider while keeping valid favorites', () => {
    const favorites: PrefillSourceProvider = {
      id: 'favorites',
      label: 'Saved favorites',
      getGroups: () => [
        {
          id: 'saved',
          label: 'Favorites',
          options: [
            { source: formFieldSource(MOCK_FORM_ID.A, 'email'), label: 'Upstream email' },
            { source: formFieldSource(MOCK_FORM_ID.F, 'email'), label: 'Downstream email' },
            { source: formFieldSource(MOCK_FORM_ID.D, 'email'), label: 'Own email' },
            { source: formFieldSource(MOCK_FORM_ID.A, 'removed'), label: 'Removed field' },
          ],
        },
      ],
    };
    const sections = buildSections([favorites, ...allPrefillProviders], contextFor('Form D'));
    const favoriteOptions = sections[0]?.groups[0]?.options;

    expect(favoriteOptions?.map((option) => option.label)).toEqual(['Upstream email']);
    expect(indexOptions(sections).has(sourceId(formFieldSource(MOCK_FORM_ID.F, 'email')))).toBe(
      false,
    );
  });
});

describe('indexOptions', () => {
  const indexFor = (formName: string, providers = allPrefillProviders) =>
    indexOptions(buildSections(providers, contextFor(formName)));

  it('describes a stored form field source by its form and field', () => {
    const resolved = indexFor('Form D').get(sourceId(formFieldSource(MOCK_FORM_ID.A, 'email')));

    expect(resolved?.groupLabel).toBe('Form A');
    expect(resolved?.option.label).toBe('Email');
  });

  it('describes a stored global source', () => {
    const resolved = indexFor('Form D').get(sourceId(globalSource('client_organization', 'name')));

    expect(resolved).toMatchObject({
      groupLabel: 'Client Organization Properties',
      option: { label: 'Organization name' },
    });
  });

  it('tells apart sources that share a label', () => {
    const index = indexFor('Form F');

    expect(index.get(sourceId(formFieldSource(MOCK_FORM_ID.D, 'email')))?.groupLabel).toBe(
      'Form D',
    );
    expect(index.get(sourceId(formFieldSource(MOCK_FORM_ID.E, 'email')))?.groupLabel).toBe(
      'Form E',
    );
  });

  it.each([
    ['a form that is not upstream', formFieldSource(MOCK_FORM_ID.F, 'email')],
    ['the form itself', formFieldSource(MOCK_FORM_ID.D, 'email')],
    ['a node that does not exist', formFieldSource('form-removed', 'email')],
    ['a field that does not exist', formFieldSource(MOCK_FORM_ID.A, 'nickname')],
    ['an unknown source type', { type: 'mystery', ownerId: MOCK_FORM_ID.A, key: 'email' }],
  ])('does not resolve a source that points at %s', (_, source) => {
    expect(indexFor('Form D').has(sourceId(source))).toBe(false);
  });

  it('stops resolving a source once its provider is turned off', () => {
    const source = globalSource('action', 'name');

    expect(indexFor('Form D').has(sourceId(source))).toBe(true);
    expect(indexFor('Form D', [directDependenciesProvider]).has(sourceId(source))).toBe(false);
  });

  it('resolves the sources of a provider added later', () => {
    const index = indexFor('Form D', [...allPrefillProviders, teamProvider]);

    expect(index.get(sourceId({ type: 'team_member', ownerId: 'owner', key: 'email' }))).toEqual({
      groupLabel: 'Owner of Form D',
      option: { source: { type: 'team_member', ownerId: 'owner', key: 'email' }, label: 'Email' },
    });
  });
});

describe('filterSections', () => {
  const sections = buildSections(allPrefillProviders, contextFor('Form D'));

  it('returns the sections unchanged for an empty or blank query', () => {
    expect(filterSections(sections, '')).toBe(sections);
    expect(filterSections(sections, '   ')).toBe(sections);
  });

  it('matches option labels, ignoring case', () => {
    const filtered = filterSections(sections, 'EMAIL');

    expect(optionLabels(filtered)).toEqual(['Email', 'Email', 'Contact email']);
  });

  it('matches source keys', () => {
    expect(optionLabels(filterSections(sections, 'created_at'))).toEqual(['Created at']);
  });

  it('matches group labels, keeping all options of the group', () => {
    const filtered = filterSections(sections, 'organization');

    expect(groupLabels(filtered)).toEqual(['Client Organization Properties']);
    expect(optionLabels(filtered)).toHaveLength(4);
  });

  it('requires every term to match, across group and option', () => {
    const filtered = filterSections(sections, 'client  email');

    expect(groupLabels(filtered)).toEqual(['Client Organization Properties']);
    expect(optionLabels(filtered)).toEqual(['Contact email']);
  });

  it('matches terms anywhere in a word', () => {
    expect(optionLabels(filterSections(sections, 'form b mail'))).toEqual(['Email']);
  });

  it('keeps sections without matches, emptied, so the caller decides what to show', () => {
    const filtered = filterSections(sections, 'no such thing');

    expect(sectionLabels(filtered)).toEqual(sectionLabels(sections));
    expect(groupLabels(filtered)).toEqual([]);
  });

  it('does not modify the sections it is given', () => {
    filterSections(sections, 'email');

    expect(optionLabels(sections)).toHaveLength(24);
  });
});
