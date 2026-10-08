import { describe, expect, it } from 'vitest';
import { sourceId } from '../domain/mappings';
import { buildBlueprint, formNamed } from '../test/builders';
import { createGlobalDataProvider, globalDataProvider, globalSource } from './globalData';

const blueprint = buildBlueprint({ a: {}, b: { dependsOn: ['a'] } });
const contextFor = (formName: string) => ({ blueprint, form: formNamed(blueprint, formName) });

describe('globalDataProvider', () => {
  it('offers the example data sets as groups', () => {
    const groups = globalDataProvider.getGroups(contextFor('Form B'));

    expect(groups.map((group) => group.label)).toEqual([
      'Action Properties',
      'Client Organization Properties',
    ]);
  });

  it('offers the same options to every form, whatever its place in the graph', () => {
    expect(globalDataProvider.getGroups(contextFor('Form A'))).toEqual(
      globalDataProvider.getGroups(contextFor('Form B')),
    );
  });

  it('gives properties with the same key in different data sets distinct identities', () => {
    const [action, organization] = globalDataProvider.getGroups(contextFor('Form A'));
    const actionName = action?.options.find((option) => option.source.key === 'name');
    const organizationName = organization?.options.find((option) => option.source.key === 'name');

    expect(actionName?.source).toEqual(globalSource('action', 'name'));
    expect(organizationName?.source).toEqual(globalSource('client_organization', 'name'));
    expect(sourceId(globalSource('action', 'name'))).not.toBe(
      sourceId(globalSource('client_organization', 'name')),
    );
  });

  it('never collides with a form field that has the same owner id and key', () => {
    expect(sourceId(globalSource('action', 'name'))).not.toBe(
      sourceId({ type: 'form_field', ownerId: 'action', key: 'name' }),
    );
  });
});

describe('createGlobalDataProvider', () => {
  it('offers whatever data sets it is given', () => {
    const provider = createGlobalDataProvider([
      { id: 'user', label: 'Current user', properties: [{ key: 'locale', label: 'Locale' }] },
    ]);

    expect(provider.getGroups(contextFor('Form A'))).toEqual([
      {
        id: 'user',
        label: 'Current user',
        options: [{ source: globalSource('user', 'locale'), label: 'Locale' }],
      },
    ]);
  });
});
