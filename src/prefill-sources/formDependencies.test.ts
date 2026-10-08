import { describe, expect, it } from 'vitest';
import { formFieldSource, sourceId } from '../domain/mappings';
import { MOCK_FORM_ID } from '../test/apiFixtures';
import { buildBlueprint, formNamed, mockBlueprint } from '../test/builders';
import { directDependenciesProvider, transitiveDependenciesProvider } from './formDependencies';
import type { PrefillOptionGroup } from './types';

const labels = (groups: PrefillOptionGroup[]) => groups.map((group) => group.label);
const ids = (groups: PrefillOptionGroup[]) =>
  groups.flatMap((group) => group.options.map((option) => sourceId(option.source)));

describe('form dependency providers on the mock server graph', () => {
  //   A ──► B ──► D ──┐
  //   │               ├──► F
  //   └───► C ──► E ──┘
  const blueprint = mockBlueprint();
  const groupsFor = (formName: string) => {
    const context = { blueprint, form: formNamed(blueprint, formName) };
    return {
      direct: directDependenciesProvider.getGroups(context),
      transitive: transitiveDependenciesProvider.getGroups(context),
    };
  };

  it('offers Form B to Form D as a direct dependency and Form A as a transitive one', () => {
    const { direct, transitive } = groupsFor('Form D');

    expect(labels(direct)).toEqual(['Form B']);
    expect(labels(transitive)).toEqual(['Form A']);
  });

  it('offers every field of a dependency, pointing at that form node', () => {
    const [formB] = groupsFor('Form D').direct;

    expect(formB?.id).toBe(MOCK_FORM_ID.B);
    expect(formB?.options).toHaveLength(8);
    expect(formB?.options).toContainEqual({
      source: formFieldSource(MOCK_FORM_ID.B, 'email'),
      label: 'Email',
      valueType: 'short-text',
    });
  });

  it('offers both parents of a diamond, and each ancestor above them once', () => {
    const { direct, transitive } = groupsFor('Form F');

    expect(labels(direct)).toEqual(['Form D', 'Form E']);
    expect(labels(transitive)).toEqual(['Form A', 'Form B', 'Form C']);
  });

  it('offers nothing to a form without dependencies', () => {
    const { direct, transitive } = groupsFor('Form A');

    expect(direct).toEqual([]);
    expect(transitive).toEqual([]);
  });

  it('never offers a form its own fields or those of a form downstream of it', () => {
    const { direct, transitive } = groupsFor('Form B');

    expect(labels([...direct, ...transitive])).toEqual(['Form A']);
  });

  it('never offers the same source from both providers', () => {
    for (const form of blueprint.forms) {
      const { direct, transitive } = groupsFor(form.name);
      const all = ids([...direct, ...transitive]);

      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('gives fields with the same key and label on different forms distinct identities', () => {
    // Forms D and E are separate nodes that render the same form definition.
    const [formD, formE] = groupsFor('Form F').direct;
    const emailOfD = formD?.options.find((option) => option.source.key === 'email');
    const emailOfE = formE?.options.find((option) => option.source.key === 'email');

    expect(emailOfD?.label).toBe(emailOfE?.label);
    expect(emailOfD?.source).toEqual(formFieldSource(MOCK_FORM_ID.D, 'email'));
    expect(emailOfE?.source).toEqual(formFieldSource(MOCK_FORM_ID.E, 'email'));
  });
});

describe('form dependency providers', () => {
  it('lists forms by name rather than by traversal order', () => {
    const blueprint = buildBlueprint({
      z: { name: 'Zeta' },
      m: { name: 'Mid', dependsOn: ['z'] },
      a: { name: 'Alpha', dependsOn: ['m'] },
      target: { name: 'Target', dependsOn: ['a'] },
    });
    const context = { blueprint, form: formNamed(blueprint, 'Target') };

    expect(labels(transitiveDependenciesProvider.getGroups(context))).toEqual(['Mid', 'Zeta']);
  });

  it('follows a dependency chain through a node that is not a form', () => {
    const blueprint = buildBlueprint({
      a: {},
      gate: { isForm: false, dependsOn: ['a'] },
      b: { dependsOn: ['gate'] },
    });
    const context = { blueprint, form: formNamed(blueprint, 'Form B') };

    expect(directDependenciesProvider.getGroups(context)).toEqual([]);
    expect(labels(transitiveDependenciesProvider.getGroups(context))).toEqual(['Form A']);
  });

  it('survives a cycle in the graph', () => {
    const blueprint = buildBlueprint({
      a: { dependsOn: ['c'] },
      b: { dependsOn: ['a'] },
      c: { dependsOn: ['b'] },
    });
    const context = { blueprint, form: formNamed(blueprint, 'Form C') };

    expect(labels(directDependenciesProvider.getGroups(context))).toEqual(['Form B']);
    expect(labels(transitiveDependenciesProvider.getGroups(context))).toEqual(['Form A']);
  });
});
