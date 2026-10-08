# Journey Builder: prefill configuration

## Overview

A React and TypeScript implementation of the Avantos Journey Builder challenge. A journey is a
DAG of forms, and a field of one form can be prefilled with a value from a form that comes
before it. The app loads the graph from the `action-blueprint-graph-get` endpoint, lists its
forms, and lets you view and edit where each field of a form gets its value from.

## Preview

| Prefill editor                     | Source picker                     |
| ---------------------------------- | --------------------------------- |
| ![Prefill editor](docs/editor.png) | ![Source picker](docs/picker.png) |

## Features

- **Forms and fields.** Lists the blueprint's forms; selecting one shows its fields and
  dependencies.
- **Mappings.** Add, replace and clear a field's prefill source. Stored mappings show on load.
- **Three kinds of source** in one searchable picker: fields of forms the selected form depends
  on **directly**, fields of forms it depends on **transitively**, and **global data**.
- **Configurable sources.** `VITE_PREFILL_SOURCES` selects and orders them, with no code change.
- **Stale mappings are flagged** as unavailable and can be replaced or cleared.
- **Loading, error and empty states**, with retry. A malformed response gives a readable error.

## Getting Started

Requires Node.js 22.13+ (22.x), 24.x, or 26+, and two terminals.

```bash
# Terminal 1: the official mock server (it has no dependencies to install)
git clone https://github.com/mosaic-avantos/frontendchallengeserver.git
cd frontendchallengeserver
npm start                      # http://localhost:3000

# Terminal 2: this app
git clone https://github.com/Reckless98/journey-builder-prefill.git
cd journey-builder-prefill
npm ci
npm run dev                    # http://localhost:5173
```

The defaults target the mock server, so no configuration is needed. To change one, copy
`.env.example` to `.env.local`:

| Variable                              | Default                              | Purpose                                                                      |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                   | `http://localhost:3000`              | API origin.                                                                  |
| `VITE_TENANT_ID`, `VITE_BLUEPRINT_ID` | `1`, `bp_01jk766tckfwx84xjcxazggzyc` | Path parameters. The mock server accepts any value.                          |
| `VITE_BLUEPRINT_VERSION_ID`           | empty                                | Extra path segment of the published API. The mock returns 404 when set.      |
| `VITE_PREFILL_SOURCES`                | empty (all sources)                  | Comma-separated provider ids, for example `global-data,direct-dependencies`. |

Provider ids: `direct-dependencies`, `transitive-dependencies`, `global-data`.

## Architecture

```
src/
  domain/           pure model: types, graph traversal, immutable mappings
  api/              fetch client, response validation, API-to-domain adapter
  prefill-sources/  provider interface, built-in providers, registry, composition
  hooks/            useBlueprint (request lifecycle), usePrefillMappings (edit state)
  components/       UI
  config.ts         environment variables
```

Imports point one way: components use hooks, hooks use the API and provider layers, and
everything rests on the domain, which has no React or network code.

**Data flow.** `useBlueprint` fetches the graph, `validateBlueprint` checks the shapes the app
reads, and `normalizeBlueprint` converts the response into a `Blueprint`: forms, a dependency
map, stored mappings, and warnings about anything it had to skip. For the selected form,
`buildSections` asks each provider for its options and returns plain data. The editor uses that
one result both to describe existing mappings and to fill the picker.

- **Domain model.** A form is identified by its graph node id, because several nodes can share
  one form definition. A source is `{ type, ownerId, key }`, and `sourceId` JSON-encodes it into
  a key that cannot collide. Mappings are a `Map` per form of field key to source, updated
  immutably by `setMapping` and `clearMapping`.
- **Graph traversal.** An edge `source → target` means the target depends on the source; the
  mock data's `prerequisites` confirm this and a test asserts it. Direct dependencies are a
  lookup. Transitive ones are a breadth-first walk upstream with a visited set, which reports a
  shared ancestor once, excludes the form itself and its direct dependencies, and ends on a
  cycle.
- **API boundary.** The client turns an unreachable server, an error status or an invalid body
  into a readable error. The adapter drops references that do not resolve and reports them as
  warnings instead of failing.
- **Providers.** A provider returns groups of options for a form. `registry.ts` lists the
  providers and `buildSections` composes them, enforcing two rules whatever they return: a form
  field is only offered while it exists upstream, and each source is offered once.
- **State.** Local React state only. `BlueprintWorkspace` owns the selected form and the
  mappings, `PrefillEditor` the open picker, and the dialog its search and selection.
  `useBlueprint` aborts superseded requests and ignores late responses.
- **UI.** `FormList`, `PrefillEditor`, `PrefillFieldRow` and `SourcePickerDialog`. The picker is
  a native `<dialog>` with radio inputs, so the focus trap, Escape and arrow-key navigation come
  from the platform.

## Extending Data Sources

A source is an object that implements `PrefillSourceProvider`:

```ts
// src/prefill-sources/currentUser.ts
import type { PrefillSourceProvider } from './types';

export const currentUserProvider: PrefillSourceProvider = {
  id: 'current-user', // unique; also the id used in VITE_PREFILL_SOURCES
  label: 'Current user', // heading of its section in the picker
  getGroups: () => [
    {
      id: 'profile',
      label: 'Profile',
      options: [{ source: { type: 'user', ownerId: 'current', key: 'email' }, label: 'Email' }],
    },
  ],
};
```

Register it by adding it to `allPrefillProviders` in `src/prefill-sources/registry.ts`. No
component changes: it gets a section in the picker, is searchable, and its selections appear on
the field rows.

- **Context.** `getGroups` receives `{ blueprint, form }`, so a provider can depend on the graph
  (as the dependency providers do) or ignore it. It must be pure and synchronous.
- **Identity.** The `source` triple is what a mapping stores. Use a `type` of your own and keep
  `ownerId` + `key` unique within it. Sources of type `form_field` are also checked against the
  graph.
- **Ordering.** Sections follow the registry order, or the order in `VITE_PREFILL_SOURCES`.
- **Composition.** Any subset works. When two providers return the same source, the earlier one
  keeps it. `App` also accepts a `providers` prop, which the tests use.

## Scalability and Design Decisions

- **Separate layers.** A change to the API contract is contained in `src/api`, and the
  traversal and mapping rules are tested without React.
- **Extension.** Components render sections, groups and options and never branch on the kind of
  source, so a new source costs one object and one registry line.
- **Cost.** Direct dependencies are a lookup; transitive ones are O(V + E) per form, computed
  when a form is selected and memoised until it changes. Forms, mappings and options live in
  `Map`s keyed by id, and options are indexed once per selected form. Typing in the search box
  only re-runs a filter that is linear in the number of options.
- **State boundaries.** Everything is client-side and in memory, for one blueprint per page
  load.

What would have to change for:

- **Persistence.** The published API saves the whole graph with `PUT` and an `If-Match` ETag.
  That needs the ETag kept from the GET and a serialiser from sources back to `input_mapping`
  expressions.
- **Asynchronous providers.** `getGroups` is synchronous. Either load the data first and build
  the provider from it, as `createGlobalDataProvider(dataSets)` allows, or make the interface
  asynchronous and give sections a loading state.
- **Much larger data.** The picker renders every option, so thousands of fields would need list
  virtualisation and a debounced search.

These are complexity statements, not measurements: the app has not been load-tested, and the
mock graph has six forms of eight fields each.

## Testing

```bash
npm run check   # typecheck, ESLint, Prettier, tests and production build (what CI runs)
npm test        # tests only
```

171 tests in 11 files, with Vitest and React Testing Library. Only `fetch` is mocked, and the
fixture is a verbatim copy of the mock server's `graph.json`.

- **Traversal:** chains, branches, diamonds, independent graphs, unknown ids, self-loops, cycles.
- **Mappings:** add, replace, clear, immutability, isolation between forms and fields.
- **API:** edge direction against `prerequisites`, malformed responses, stored mappings, URL
  building, errors and aborts.
- **Providers:** each source, combinations and ordering, a provider added later, stale or
  invalid sources, search.
- **Request lifecycle:** superseded requests, late responses, revisiting a URL, unmount.
- **UI flows:** load, select a form, add, replace, clear, cancel, search, switch forms, error
  and retry, empty state.

jsdom has no modal `<dialog>`, so Escape, the focus trap and outside-click dismissal are not
covered by the automated tests. They were checked manually in Chromium.

## Assumptions and Limitations

- **Stored mappings are read on an assumption.** `input_mapping` is empty on every node of the
  mock, and the published schema allows more than thirty expression types there. The adapter
  reads `action_component_data` (`component_key` + `output_key`) as a form-field prefill. Any
  other expression is reported and not shown.
- **Edits are not saved.** They live in memory. The mock server is read-only: every non-GET
  request returns 404.
- **Global data is example data.** The brief leaves its content open.
- **Mock and published API differ.** The mock omits the `{blueprint_version_id}` path segment
  and returns `id` / `name` where the published schema has `blueprint_id` / `blueprint_name`.
  The client and adapter accept both, but only the mock was exercised end to end.
- **Dependencies come from `edges`.** A form reached through a non-form node counts as
  transitive. Cycles are tolerated, not reported.
- **Browser coverage.** Outside-click dismissal needs `closedby` support; Escape, Cancel and
  Close always work. Verified in Chromium only.
