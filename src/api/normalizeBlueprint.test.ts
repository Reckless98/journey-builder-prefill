import { describe, expect, it } from 'vitest';
import { formFieldSource } from '../domain/mappings';
import {
  apiForm,
  apiNode,
  apiResponse,
  MOCK_FORM_ID,
  mockServerResponse,
} from '../test/apiFixtures';
import { normalizeBlueprint } from './normalizeBlueprint';

describe('normalizeBlueprint with the mock server response', () => {
  const response = mockServerResponse();
  const blueprint = normalizeBlueprint(response);

  it('reads the blueprint details', () => {
    expect(blueprint.id).toBe('bp_01jk766tckfwx84xjcxazggzyc');
    expect(blueprint.name).toBe('Onboard Customer 0');
    expect(blueprint.description).toBe('Automated test action');
  });

  it('returns the form nodes sorted by name, whatever order the API used', () => {
    expect(response.nodes?.map((node) => node.data.name)).toEqual([
      'Form F',
      'Form D',
      'Form A',
      'Form C',
      'Form B',
      'Form E',
    ]);
    expect(blueprint.forms.map((form) => form.name)).toEqual([
      'Form A',
      'Form B',
      'Form C',
      'Form D',
      'Form E',
      'Form F',
    ]);
  });

  it('identifies forms by node id, since several nodes share one form definition', () => {
    const formA = blueprint.forms.find((form) => form.name === 'Form A');
    const formD = blueprint.forms.find((form) => form.name === 'Form D');

    expect(formA?.definitionId).toBe(formD?.definitionId);
    expect(formA?.id).toBe(MOCK_FORM_ID.A);
    expect(formD?.id).toBe(MOCK_FORM_ID.D);
  });

  it('reads the fields of a form from its definition, in schema order', () => {
    const formA = blueprint.forms.find((form) => form.id === MOCK_FORM_ID.A);

    expect(formA?.definitionName).toBe('test form');
    expect(formA?.fields).toEqual([
      { key: 'button', label: 'Button', type: 'button', required: false },
      {
        key: 'dynamic_checkbox_group',
        label: 'Dynamic Checkbox Group',
        type: 'checkbox-group',
        required: false,
      },
      { key: 'dynamic_object', label: 'Dynamic Object', type: 'object-enum', required: false },
      { key: 'email', label: 'Email', type: 'short-text', required: true },
      { key: 'id', label: 'ID', type: 'short-text', required: true },
      { key: 'multi_select', label: 'Multi Select', type: 'multi-select', required: false },
      { key: 'name', label: 'Name', type: 'short-text', required: true },
      { key: 'notes', label: 'Notes', type: 'multi-line-text', required: false },
    ]);
  });

  it('maps each node to the nodes it directly depends on', () => {
    const { A, B, C, D, E, F } = MOCK_FORM_ID;

    expect(Object.fromEntries(blueprint.dependencies)).toEqual({
      [A]: [],
      [B]: [A],
      [C]: [A],
      [D]: [B],
      [E]: [C],
      [F]: [D, E],
    });
  });

  it('reads edges in the direction the prerequisites confirm: source before target', () => {
    for (const node of response.nodes ?? []) {
      const fromEdges = blueprint.dependencies.get(node.id) ?? [];

      expect(new Set(fromEdges)).toEqual(new Set(node.data.prerequisites));
    }
  });

  it('finds no stored prefill mappings and nothing to warn about', () => {
    expect(blueprint.prefill.size).toBe(0);
    expect(blueprint.warnings).toEqual([]);
  });
});

describe('normalizeBlueprint', () => {
  it('prefers the field names of the published schema over the mock server ones', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({ id: 'old', name: 'Old', blueprint_id: 'bp_1', blueprint_name: 'Current' }),
    );

    expect(blueprint).toMatchObject({ id: 'bp_1', name: 'Current' });
  });

  it('treats null collections as empty', () => {
    const blueprint = normalizeBlueprint({ nodes: null, edges: null, forms: null });

    expect(blueprint.forms).toEqual([]);
    expect(blueprint.dependencies.size).toBe(0);
    expect(blueprint.name).toBe('Untitled blueprint');
    expect(blueprint.warnings).toEqual([]);
  });

  it('sorts form names naturally and breaks ties by id', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('n3', 'Form 10'),
          apiNode('n2', 'Form 2'),
          apiNode('n9', 'Form 1'),
          apiNode('n1', 'Form 1'),
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.forms.map((form) => form.id)).toEqual(['n1', 'n9', 'n2', 'n3']);
  });

  it('keeps nodes that are not forms in the graph but not in the form list', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('a', 'Form A'),
          apiNode('gate', 'Approval gate', 'br_1', {}, 'branch'),
          apiNode('b', 'Form B'),
        ],
        edges: [
          { source: 'a', target: 'gate' },
          { source: 'gate', target: 'b' },
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.forms.map((form) => form.id)).toEqual(['a', 'b']);
    expect(blueprint.dependencies.get('b')).toEqual(['gate']);
    expect(blueprint.dependencies.get('gate')).toEqual(['a']);
    expect(blueprint.warnings).toEqual([]);
  });

  it('drops edges that refer to unknown nodes and reports them', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [apiNode('a', 'Form A'), apiNode('b', 'Form B')],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'ghost', target: 'b' },
          { source: 'a', target: 'phantom' },
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.dependencies.get('b')).toEqual(['a']);
    expect(blueprint.dependencies.has('phantom')).toBe(false);
    expect(blueprint.warnings).toHaveLength(2);
    expect(blueprint.warnings[0]).toContain('"ghost" → "b"');
    expect(blueprint.warnings[1]).toContain('"a" → "phantom"');
  });

  it('collapses duplicate edges and ignores an edge from a node to itself', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [apiNode('a', 'Form A'), apiNode('b', 'Form B')],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'a', target: 'b' },
          { source: 'b', target: 'b' },
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.dependencies.get('b')).toEqual(['a']);
  });

  it('shows a form without fields when its definition is missing, and reports it', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({ nodes: [apiNode('a', 'Form A', 'f_missing')] }),
    );

    expect(blueprint.forms).toHaveLength(1);
    expect(blueprint.forms[0]?.fields).toEqual([]);
    expect(blueprint.warnings[0]).toContain('"f_missing"');
  });

  it('keeps the first of two nodes with the same id and reports the other', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [apiNode('a', 'First'), apiNode('a', 'Second')],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.forms.map((form) => form.name)).toEqual(['First']);
    expect(blueprint.warnings).toHaveLength(1);
  });

  it('labels a field with its title, then its UI schema label, then its key', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [apiNode('a', 'Form A', 'f_1')],
        forms: [
          {
            id: 'f_1',
            field_schema: {
              properties: {
                titled: { avantos_type: 'short-text', title: 'From title' },
                labelled: { avantos_type: 'short-text' },
                nested: { type: 'string' },
                bare: {},
              },
            },
            ui_schema: {
              elements: [
                { scope: '#/properties/titled', label: 'Ignored' },
                { scope: '#/properties/labelled', label: 'From UI schema' },
                { elements: [{ scope: '#/properties/nested', label: 'From nested layout' }] },
              ],
            },
          },
        ],
      }),
    );

    expect(blueprint.forms[0]?.fields).toEqual([
      { key: 'titled', label: 'From title', type: 'short-text', required: false },
      { key: 'labelled', label: 'From UI schema', type: 'short-text', required: false },
      { key: 'nested', label: 'From nested layout', type: 'string', required: false },
      { key: 'bare', label: 'bare', type: 'unknown', required: false },
    ]);
  });
});

describe('normalizeBlueprint reading stored input mappings', () => {
  const componentData = (nodeId: string, fieldKey: string, isMetadata = false) => ({
    type: 'action_component_data',
    component_key: nodeId,
    output_key: fieldKey,
    is_metadata: isMetadata,
  });

  it('reads an action_component_data expression as a form field source', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('a', 'Form A'),
          apiNode('b', 'Form B', 'f_default', {
            input_mapping: { email: componentData('a', 'name') },
          }),
        ],
        edges: [{ source: 'a', target: 'b' }],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.prefill.get('b')?.get('email')).toEqual(formFieldSource('a', 'name'));
    expect(blueprint.prefill.has('a')).toBe(false);
    expect(blueprint.warnings).toEqual([]);
  });

  it('keeps a mapping whose source node no longer exists, for the editor to flag', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('b', 'Form B', 'f_default', {
            input_mapping: { email: componentData('removed', 'email') },
          }),
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.prefill.get('b')?.get('email')).toEqual(formFieldSource('removed', 'email'));
  });

  it('reports expressions it cannot interpret instead of guessing', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('b', 'Form B', 'f_default', {
            input_mapping: {
              email: { type: 'literal', value: 'a@b.c' },
              name: componentData('a', 'submitted_at', true),
            },
          }),
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.prefill.size).toBe(0);
    expect(blueprint.warnings).toHaveLength(2);
    expect(blueprint.warnings[0]).toContain('"literal"');
    expect(blueprint.warnings[1]).toContain('"action_component_data"');
  });

  it('reports a mapping for a key that is not a field of the form', () => {
    const blueprint = normalizeBlueprint(
      apiResponse({
        nodes: [
          apiNode('b', 'Form B', 'f_default', {
            input_mapping: { nickname: componentData('a', 'name') },
          }),
        ],
        forms: [apiForm('f_default')],
      }),
    );

    expect(blueprint.prefill.size).toBe(0);
    expect(blueprint.warnings[0]).toContain('"nickname"');
  });
});
