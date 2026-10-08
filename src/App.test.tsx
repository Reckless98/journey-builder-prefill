import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { BlueprintGraphResponse } from './api/types';
import { createGlobalDataProvider, globalDataProvider } from './prefill-sources/globalData';
import { defaultPrefillProviders } from './prefill-sources/registry';
import type { PrefillSourceProvider } from './prefill-sources/types';
import {
  apiForm,
  apiNode,
  apiResponse,
  MOCK_FORM_ID,
  mockServerResponse,
} from './test/apiFixtures';

/**
 * These tests drive the whole app the way a user does. Only the network is replaced: `fetch`
 * answers with the mock server's real graph (A → B → D → F, A → C → E → F) unless a test says
 * otherwise.
 */

const request = { baseUrl: 'http://api.test', tenantId: '1', blueprintId: 'bp_1' };

function stubFetch(...responses: (() => Promise<Response>)[]) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((respond, index) => {
    if (index === responses.length - 1) fetchMock.mockImplementation(respond);
    else fetchMock.mockImplementationOnce(respond);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const respondWith = (body: unknown, init?: ResponseInit) => () =>
  Promise.resolve(Response.json(body, init));

/** Renders the app against a graph and waits until its forms are on screen. */
async function renderLoadedApp(
  graph: BlueprintGraphResponse = mockServerResponse(),
  providers?: readonly PrefillSourceProvider[],
) {
  stubFetch(respondWith(graph));
  const user = userEvent.setup();
  render(<App request={request} providers={providers} />);
  await screen.findByRole('navigation', { name: 'Forms' });
  return user;
}

const formButton = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Forms' })).getByRole('button', {
    name: new RegExp(`^${name}`),
  });

const selectForm = (user: UserEvent, name: string) => user.click(formButton(name));

const selectSourceButton = (fieldLabel: string) =>
  screen.getByRole('button', { name: `Select source for ${fieldLabel}` });

/** The button of a mapped field. Its name states the current source, e.g. "Form A Email". */
const mappedButton = (fieldLabel: string, currentSource: string) =>
  screen.getByRole('button', {
    name: `Change source for ${fieldLabel}, currently ${currentSource}`,
  });

const picker = () => within(screen.getByRole('dialog', { name: 'Select a prefill source' }));

const option = (groupName: string, optionLabel: string) =>
  within(picker().getByRole('group', { name: groupName })).getByRole('radio', {
    name: new RegExp(`^${optionLabel}`),
  });

/** Opens the picker for an unmapped field, picks an option and confirms. */
async function mapField(user: UserEvent, fieldLabel: string, groupName: string, label: string) {
  await user.click(selectSourceButton(fieldLabel));
  await user.click(option(groupName, label));
  await user.click(picker().getByRole('button', { name: 'Select' }));
}

describe('loading the blueprint', () => {
  it('shows a loading state, then the forms from the API sorted by name', async () => {
    const fetchMock = stubFetch(respondWith(mockServerResponse()));
    render(<App request={request} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading blueprint…');

    const forms = await screen.findByRole('navigation', { name: 'Forms' });
    expect(
      within(forms)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Form A8 fields',
      'Form B8 fields',
      'Form C8 fields',
      'Form D8 fields',
      'Form E8 fields',
      'Form F8 fields',
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Onboard Customer 0' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/v1/1/actions/blueprints/bp_1/graph',
      expect.anything(),
    );
  });

  it('shows the error and loads the blueprint after a retry', async () => {
    const fetchMock = stubFetch(
      respondWith({ error: 'boom' }, { status: 500, statusText: 'Internal Server Error' }),
      respondWith(mockServerResponse()),
    );
    const user = userEvent.setup();
    render(<App request={request} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The blueprint could not be loaded');
    expect(alert).toHaveTextContent('The API responded with 500 Internal Server Error');

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('navigation', { name: 'Forms' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains when the server cannot be reached', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<App request={request} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the API at http://api.test/api/v1/1/actions/blueprints/bp_1/graph',
    );
  });

  it('says so when the blueprint has no forms', async () => {
    stubFetch(respondWith(apiResponse({ name: 'Empty journey' })));
    render(<App request={request} />);

    expect(await screen.findByText('This blueprint has no forms')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Forms' })).not.toBeInTheDocument();
  });

  it('lists the parts of the response it had to skip', async () => {
    const graph = mockServerResponse();
    graph.edges?.push({ source: 'form-removed', target: MOCK_FORM_ID.F });
    await renderLoadedApp(graph);

    expect(screen.getByText('1 part of this blueprint could not be used')).toBeInTheDocument();
    expect(screen.getByText(/"form-removed" → /)).toBeInTheDocument();
  });
});

describe('selecting a form', () => {
  it('starts on the first form and lists its fields', async () => {
    await renderLoadedApp();

    expect(formButton('Form A')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { name: 'Form A' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Fields of Form A' })).getAllByRole('listitem'),
    ).toHaveLength(8);
    expect(screen.getByText('0 of 8 fields prefilled')).toBeInTheDocument();
    expect(screen.getByText('Does not depend on any other form.')).toBeInTheDocument();
  });

  it('shows the selected form, its fields and where it sits in the graph', async () => {
    const user = await renderLoadedApp();

    await selectForm(user, 'Form F');

    expect(formButton('Form F')).toHaveAttribute('aria-current', 'true');
    expect(formButton('Form A')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { name: 'Form F' })).toBeInTheDocument();
    expect(screen.getByText('Depends directly on').nextElementSibling).toHaveTextContent(
      /^Form DForm E$/,
    );
    expect(screen.getByText('Depends indirectly on').nextElementSibling).toHaveTextContent(
      /^Form AForm BForm C$/,
    );
    expect(screen.getByText('Dynamic Checkbox Group')).toBeInTheDocument();
    expect(screen.getByText('dynamic_checkbox_group')).toBeInTheDocument();
  });
});

describe('the source picker', () => {
  it('offers direct dependencies, transitive dependencies and global data', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');

    await user.click(selectSourceButton('Email'));

    const groupsIn = (sectionName: string) =>
      within(picker().getByRole('region', { name: sectionName }))
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent);

    expect(groupsIn('Direct dependencies')).toEqual(['Form B']);
    expect(groupsIn('Transitive dependencies')).toEqual(['Form A']);
    expect(groupsIn('Global data')).toEqual([
      'Action Properties',
      'Client Organization Properties',
    ]);
    expect(picker().getByText('Email', { selector: 'header *' })).toBeInTheDocument();
    expect(picker().getByRole('searchbox', { name: 'Search sources' })).toHaveFocus();
    expect(picker().getByRole('button', { name: 'Select' })).toBeDisabled();
  });

  it('says when a source has nothing for the form, and still offers the others', async () => {
    const user = await renderLoadedApp();

    await user.click(selectSourceButton('Email'));

    const direct = within(picker().getByRole('region', { name: 'Direct dependencies' }));
    expect(direct.getByText('Nothing available for this form.')).toBeInTheDocument();
    expect(direct.queryByRole('radio')).not.toBeInTheDocument();
    expect(option('Action Properties', 'Action name')).toBeInTheDocument();
  });

  it('filters the options by a search and reports when nothing matches', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await user.click(selectSourceButton('Email'));
    const search = picker().getByRole('searchbox', { name: 'Search sources' });

    await user.type(search, 'notes');
    expect(picker().getAllByRole('radio')).toHaveLength(2);
    expect(picker().queryByRole('region', { name: 'Global data' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(picker().queryByRole('radio')).not.toBeInTheDocument();
    expect(picker().getByText('No sources match “zzz”.')).toBeInTheDocument();

    await user.clear(search);
    expect(picker().getAllByRole('radio')).toHaveLength(24);
  });

  it.each(['Cancel', 'Close'])('closes without changing anything on %s', async (buttonName) => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await user.click(selectSourceButton('Email'));
    await user.click(option('Form A', 'Email'));

    await user.click(picker().getByRole('button', { name: buttonName }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(selectSourceButton('Email')).toHaveFocus();
    expect(screen.getByText('0 of 8 fields prefilled')).toBeInTheDocument();
  });
});

describe('editing prefill mappings', () => {
  it('adds a mapping and shows it on the field', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');

    await mapField(user, 'Email', 'Form A', 'Email');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mappedButton('Email', 'Form A Email')).toHaveFocus();
    expect(screen.getByText('1 of 8 fields prefilled')).toBeInTheDocument();
    expect(formButton('Form D')).toHaveTextContent('1 prefilled');
    expect(screen.queryByRole('button', { name: 'Select source for Email' })).toBeNull();
  });

  it('replaces a mapping, starting from the current source', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await mapField(user, 'Email', 'Form A', 'Email');

    await user.click(mappedButton('Email', 'Form A Email'));

    expect(option('Form A', 'Email')).toBeChecked();
    expect(picker().getByText('Form A › Email')).toBeInTheDocument();
    expect(picker().getByRole('button', { name: 'Select' })).toBeDisabled();

    await user.click(option('Client Organization Properties', 'Contact email'));
    await user.click(picker().getByRole('button', { name: 'Select' }));

    expect(
      mappedButton('Email', 'Client Organization Properties Contact email'),
    ).toBeInTheDocument();
    expect(screen.getByText('1 of 8 fields prefilled')).toBeInTheDocument();
  });

  it('clears a mapping', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await mapField(user, 'Email', 'Form A', 'Email');

    await user.click(screen.getByRole('button', { name: 'Clear prefill for Email' }));

    expect(selectSourceButton('Email')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear prefill for Email' })).toBeNull();
    expect(screen.getByText('0 of 8 fields prefilled')).toBeInTheDocument();
    expect(formButton('Form D')).not.toHaveTextContent('prefilled');
  });

  it('only touches the edited field', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await mapField(user, 'Email', 'Form A', 'Email');
    await mapField(user, 'Name', 'Form B', 'Name');

    await user.click(screen.getByRole('button', { name: 'Clear prefill for Email' }));

    expect(mappedButton('Name', 'Form B Name')).toBeInTheDocument();
    expect(selectSourceButton('Notes')).toBeInTheDocument();
  });

  it('keeps the mappings of other forms while switching and editing', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await mapField(user, 'Email', 'Form A', 'Email');

    await selectForm(user, 'Form F');
    expect(selectSourceButton('Email')).toBeInTheDocument();
    await mapField(user, 'Email', 'Form E', 'Email');
    await user.click(screen.getByRole('button', { name: 'Clear prefill for Email' }));

    await selectForm(user, 'Form D');
    expect(mappedButton('Email', 'Form A Email')).toBeInTheDocument();
    expect(formButton('Form D')).toHaveTextContent('1 prefilled');
    expect(formButton('Form F')).not.toHaveTextContent('prefilled');
  });

  it('does not carry an open picker over to another form', async () => {
    const user = await renderLoadedApp();
    await selectForm(user, 'Form D');
    await user.click(selectSourceButton('Email'));
    await user.click(picker().getByRole('button', { name: 'Cancel' }));

    await selectForm(user, 'Form E');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Form E' })).toBeInTheDocument();
  });
});

describe('mappings stored on the blueprint', () => {
  const componentData = (nodeId: string, fieldKey: string) => ({
    type: 'action_component_data',
    component_key: nodeId,
    output_key: fieldKey,
    is_metadata: false,
  });

  function graphWithMappingsOnFormD(
    inputMapping: Record<string, ReturnType<typeof componentData>>,
  ) {
    const graph = mockServerResponse();
    const formD = graph.nodes?.find((node) => node.id === MOCK_FORM_ID.D);
    if (!formD) throw new Error('The fixture has no Form D');
    formD.data.input_mapping = inputMapping;
    return graph;
  }

  it('shows them when the form is opened', async () => {
    const user = await renderLoadedApp(
      graphWithMappingsOnFormD({ email: componentData(MOCK_FORM_ID.A, 'email') }),
    );

    expect(formButton('Form D')).toHaveTextContent('1 prefilled');
    await selectForm(user, 'Form D');

    expect(mappedButton('Email', 'Form A Email')).toBeInTheDocument();
  });

  it('flags a mapping whose source is not upstream of the form, and lets it be replaced', async () => {
    // Form F depends on Form D, so it cannot be a source for it.
    const user = await renderLoadedApp(
      graphWithMappingsOnFormD({ name: componentData(MOCK_FORM_ID.F, 'name') }),
    );
    await selectForm(user, 'Form D');

    expect(mappedButton('Name', 'an unavailable source')).toHaveTextContent('Unavailable source');
    expect(screen.getByText(/is not available to this form/)).toBeInTheDocument();

    await user.click(mappedButton('Name', 'an unavailable source'));
    expect(picker().queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    await user.click(option('Form B', 'Name'));
    await user.click(picker().getByRole('button', { name: 'Select' }));

    expect(mappedButton('Name', 'Form B Name')).toBeInTheDocument();
    expect(screen.queryByText(/is not available to this form/)).not.toBeInTheDocument();
  });

  it('lets an unavailable mapping be cleared', async () => {
    const user = await renderLoadedApp(
      graphWithMappingsOnFormD({ name: componentData('form-removed', 'name') }),
    );
    await selectForm(user, 'Form D');

    await user.click(screen.getByRole('button', { name: 'Clear prefill for Name' }));

    expect(selectSourceButton('Name')).toBeInTheDocument();
  });
});

describe('configuring the prefill sources', () => {
  it('offers a new provider in the picker and on the field without any UI change', async () => {
    const teamProvider: PrefillSourceProvider = {
      id: 'team',
      label: 'Team',
      getGroups: ({ form }) => [
        {
          id: 'owner',
          label: `Owner of ${form.name}`,
          options: [
            {
              source: { type: 'team_member', ownerId: 'owner', key: 'email' },
              label: 'Work email',
            },
          ],
        },
      ],
    };
    const user = await renderLoadedApp(mockServerResponse(), [
      ...defaultPrefillProviders,
      teamProvider,
    ]);
    await selectForm(user, 'Form D');

    await user.click(selectSourceButton('Email'));
    expect(picker().getByRole('region', { name: 'Team' })).toBeInTheDocument();
    await user.click(option('Owner of Form D', 'Work email'));
    await user.click(picker().getByRole('button', { name: 'Select' }));

    expect(mappedButton('Email', 'Owner of Form D Work email')).toBeInTheDocument();
  });

  it('offers only the providers it is given', async () => {
    const user = await renderLoadedApp(mockServerResponse(), [globalDataProvider]);
    await selectForm(user, 'Form D');

    await user.click(selectSourceButton('Email'));

    expect(picker().getAllByRole('region')).toHaveLength(1);
    expect(picker().getByRole('region', { name: 'Global data' })).toBeInTheDocument();
    expect(picker().queryByRole('group', { name: 'Form B' })).not.toBeInTheDocument();
  });

  it('accepts global data defined by the caller', async () => {
    const provider = createGlobalDataProvider([
      { id: 'user', label: 'Current user', properties: [{ key: 'locale', label: 'Locale' }] },
    ]);
    const user = await renderLoadedApp(mockServerResponse(), [provider]);

    await mapField(user, 'Notes', 'Current user', 'Locale');

    expect(mappedButton('Notes', 'Current user Locale')).toBeInTheDocument();
  });

  it('says so when no provider is configured', async () => {
    const user = await renderLoadedApp(mockServerResponse(), []);

    await user.click(selectSourceButton('Email'));

    expect(picker().getByText('No prefill sources are configured.')).toBeInTheDocument();
  });

  it('works for forms that share a definition and for nodes that are not forms', async () => {
    // a ──► gate (not a form) ──► b, and both forms render the same definition.
    const user = await renderLoadedApp(
      apiResponse({
        nodes: [
          apiNode('a', 'Intake'),
          apiNode('gate', 'Approval gate', 'br_1', {}, 'branch'),
          apiNode('b', 'Review'),
        ],
        edges: [
          { source: 'a', target: 'gate' },
          { source: 'gate', target: 'b' },
        ],
        forms: [apiForm('f_default', ['email'])],
      }),
    );

    expect(screen.queryByRole('button', { name: /Approval gate/ })).not.toBeInTheDocument();
    await selectForm(user, 'Review');
    await user.click(selectSourceButton('email'));

    expect(
      within(picker().getByRole('region', { name: 'Transitive dependencies' })).getByRole('group', {
        name: 'Intake',
      }),
    ).toBeInTheDocument();
  });
});
