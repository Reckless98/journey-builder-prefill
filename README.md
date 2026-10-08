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

Requires Node.js 22.13+ (22.x), 24.x, or 26+.

```bash
git clone https://github.com/Reckless98/journey-builder-prefill.git
cd journey-builder-prefill
npm ci

# One-time setup: clone the official mock inside the app checkout.
# It has no dependencies to install and is ignored by this repository.
git clone https://github.com/mosaic-avantos/frontendchallengeserver.git frontendchallengeserver

npm run start
```

`npm run start` (or `npm start`) runs the official mock API at `http://127.0.0.1:3000`
and the Vite app at `http://127.0.0.1:5173` in one terminal. Open the app URL in your
browser. Press Ctrl+C to stop both. If either process exits, its companion also stops.
Ports 3000 and 5173 must be free; stop any separately running copies first. Vite uses
`--strictPort` so an occupied app port produces an error instead of silently moving.

The mock launcher checks the checkout first and prints the clone command if files are missing.
It loads the official server unchanged and supplies a loopback host to its `listen` call;
the official source itself otherwise listens on all interfaces. The default API URL also
works through `localhost:3000`.

To run them separately, use `npm --prefix frontendchallengeserver start` in one terminal
and `npm run dev` in another. `npm run build` produces the app's production assets;
`npm run start` is the local development setup.

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

UI components and hooks use the API, provider, and domain layers as needed. The domain is
the shared foundation and has no React or network code.

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
  into a readable error. The adapter drops invalid edges and target-field mappings with warnings;
  stale source references remain visible so they can be repaired or cleared.
- **Providers.** A provider returns groups of options for a form. `registry.ts` lists the
  providers and `buildSections` composes their typed outputs, enforcing two rules: a form
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
- **Cost.** A direct lookup also filters and deduplicates its parent list, O(d). Each transitive
  traversal is O(V + E) over the reachable graph. The editor memoises composed sections and their
  option index while its blueprint, form and provider references stay unchanged. Composition and
  the dependency summary perform separate traversals. Mappings and option indices use `Map`s;
  copying a mapping for an immutable update costs O(forms + mapped fields in that form).
  Search scans offered options for every term; the picker still renders every matching option.
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

These are complexity statements, not production capacity claims. The mock graph has six forms
of eight fields each; synthetic browser measurements are kept in the separate local verification
report, rather than treated as a supported workload.

## Testing

```bash
npm run check   # typecheck, ESLint, Prettier, tests and production build (what CI runs)
npm test        # tests only
```

174 tests in 11 files, with Vitest and React Testing Library. Tests stub `fetch` and supply
partial native-dialog stand-ins for jsdom; application components and domain logic run normally.
The fixture is a verbatim copy of the mock server's `graph.json`.

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
covered by Vitest. They were verified with Playwright assertions in real Chromium. Those
browser checks are separate from `npm run check` and are not part of repository CI.

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
