# Journey Builder: prefill configuration

A React app for the Avantos Journey Builder challenge. It loads a blueprint (a DAG of forms)
from the `action-blueprint-graph-get` endpoint, lists the forms, and lets you view and edit
where each field of a form is prefilled from: a field of a form it depends on directly, a field
of a form it depends on transitively, or global data.

| The prefill editor                 | Choosing a source                 |
| ---------------------------------- | --------------------------------- |
| ![Prefill editor](docs/editor.png) | ![Source picker](docs/picker.png) |

## Contents

- [Run it locally](#run-it-locally)
- [What is implemented](#what-is-implemented)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [How it works: a tour of every part](#how-it-works-a-tour-of-every-part)
- [Adding a new data source](#adding-a-new-data-source)
- [Tests](#tests)
- [Design decisions and trade-offs](#design-decisions-and-trade-offs)
- [What the API actually returns](#what-the-api-actually-returns)
- [Known limitations](#known-limitations)

## Run it locally

Use Node.js 22.13+ (22.x), 24.x, or 26+. The locked Vitest 5 release does not support Node 20
or odd-numbered Node 23/25 releases. CI uses Node 22. You need two terminals.

**1. Start the mock server** (it has no dependencies to install):

```bash
git clone https://github.com/mosaic-avantos/frontendchallengeserver.git
cd frontendchallengeserver
npm start
# Server is running on http://localhost:3000
```

**2. Start this app:**

```bash
git clone https://github.com/Reckless98/journey-builder-prefill.git
cd journey-builder-prefill
npm ci
npm run dev
# open http://localhost:5173
```

That is all. The app talks to `http://localhost:3000` by default. If the server is not running
you get an error panel with a **Try again** button rather than a blank page.

## What is implemented

| Requirement                                          | Where                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Fetch the graph from `action-blueprint-graph-get`    | `src/api/blueprintClient.ts`, `src/hooks/useBlueprint.ts`                          |
| Render a list of forms                               | `src/components/FormList.tsx`                                                      |
| View the prefill mapping of a form                   | `src/components/PrefillEditor.tsx`, `PrefillFieldRow.tsx`                          |
| Clear a mapping with the X button                    | `PrefillFieldRow.tsx` → `clearMapping` in `src/domain/mappings.ts`                 |
| Click an unmapped field to open a modal              | `src/components/SourcePickerDialog.tsx`                                            |
| Fields of forms the form **directly** depends on     | `directDependenciesProvider` in `src/prefill-sources/formDependencies.ts`          |
| Fields of forms the form **transitively** depends on | `transitiveDependenciesProvider`, same file; traversal in `src/domain/graph.ts`    |
| Global data                                          | `src/prefill-sources/globalData.ts`                                                |
| Any combination of sources without code changes      | `VITE_PREFILL_SOURCES`, see [Configuration](#configuration)                        |
| Easy support for new data sources                    | One interface, one list: see [Adding a new data source](#adding-a-new-data-source) |

Beyond the brief: replacing a mapping, search in the picker, loading / error / empty states with
retry, mappings already stored on the blueprint are shown, and a mapping whose source is no
longer valid for the form is flagged instead of silently displayed.

## Configuration

Every variable is optional. Copy `.env.example` to `.env.local` to override the defaults.

| Variable                    | Default                         | Purpose                                                                                                            |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`         | `http://localhost:3000`         | Where the API lives.                                                                                               |
| `VITE_TENANT_ID`            | `1`                             | `{tenant_id}` path parameter. The mock server accepts anything.                                                    |
| `VITE_BLUEPRINT_ID`         | `bp_01jk766tckfwx84xjcxazggzyc` | `{action_blueprint_id}` path parameter. The mock server accepts anything.                                          |
| `VITE_BLUEPRINT_VERSION_ID` | _(empty)_                       | `{blueprint_version_id}` segment of the published API. Leave empty for the mock server, which 404s when it is set. |
| `VITE_PREFILL_SOURCES`      | _(empty = all)_                 | Comma-separated provider ids: which sources to offer and in which order.                                           |

The last one is how "any combination of data sources" works without touching code:

```bash
VITE_PREFILL_SOURCES=global-data npm run dev                      # global data only
VITE_PREFILL_SOURCES=global-data,direct-dependencies npm run dev  # two sources, global first
```

The ids are `direct-dependencies`, `transitive-dependencies` and `global-data`. An id that
matches nothing is skipped and reported in the browser console.

## Scripts

| Command              | What it does                                                           |
| -------------------- | ---------------------------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload on http://localhost:5173.                   |
| `npm test`           | Run the test suite once.                                               |
| `npm run test:watch` | Run tests in watch mode.                                               |
| `npm run typecheck`  | TypeScript, strict.                                                    |
| `npm run lint`       | ESLint with type-aware rules.                                          |
| `npm run format`     | Format with Prettier (`format:check` only checks).                     |
| `npm run build`      | Typecheck and build to `dist/`.                                        |
| `npm run preview`    | Serve the production build.                                            |
| `npm run check`      | Everything above that can fail: typecheck, lint, format, tests, build. |

## How it works: a tour of every part

The code is organised in layers. Each folder only imports from the ones above it in this list,
so the logic that matters can be read and tested without React.

```
src/
  domain/            pure model: types, DAG traversal, mapping state      (no React, no API)
  api/               transport types, fetch client, API → domain adapter
  prefill-sources/   the provider interface, the built-in providers, how they are combined
  hooks/             the two stateful hooks
  components/        the UI
  config.ts          everything read from the environment
  test/              fixtures and builders shared by tests
```

The path of the data, from the network to the screen:

```
 mock server                     src/api                          src/domain
┌───────────┐  fetch   ┌──────────────────────┐  normalize  ┌──────────────────────┐
│ graph.json│ ───────► │ BlueprintGraphResponse│ ──────────► │ Blueprint             │
└───────────┘          │ (raw: nodes, edges,   │             │  forms[]              │
                       │  forms, input_mapping)│             │  dependencies (Map)   │
                       └──────────────────────┘             │  prefill (Map)        │
                                                            └──────────┬───────────┘
                                                                       │
              src/prefill-sources                                      ▼
┌────────────────────────────────────────────┐      providers.getGroups({ blueprint, form })
│ direct deps │ transitive deps │ global data │ ◄────────────────────────┘
└──────────────────────┬─────────────────────┘
                       │ buildSections()
                       ▼
              PrefillSection[]  ──► PrefillEditor  (describes the stored mappings)
                                └─► SourcePickerDialog  (lists what can be chosen)
```

### 1. Domain types: `src/domain/types.ts`

**What.** The vocabulary of the app: `Blueprint`, `FormNode`, `FormField`, `DependencyMap`,
`PrefillSource`, `PrefillMappings`.

**How.** Plain readonly interfaces and `Map`s. A `FormNode` is identified by its node id. A
`PrefillSource` is three strings, `{ type, ownerId, key }`, meaning "the value named `key` on the
thing `ownerId` of kind `type`", for example `{ type: 'form_field', ownerId: <node id>, key: 'email' }`.

**Why.** The raw response is shaped for the API's needs, not the UI's: fields live inside a JSON
Schema, forms are split across `nodes` and `forms`, and several nodes share one form definition.
Converting once into a small model keeps every component free of that knowledge. The source is
an open triple rather than a closed union so that a new kind of source needs no change to this
file.

### 2. DAG traversal: `src/domain/graph.ts`

**What.** Two pure functions: `getDirectDependencies(dependencies, nodeId)` and
`getTransitiveDependencies(dependencies, nodeId)`.

**How.** `DependencyMap` maps each node id to the ids it directly depends on. Direct
dependencies are a lookup. Transitive dependencies are a breadth-first walk upstream that starts
from the direct dependencies and collects every node found beyond them. A `visited` set, seeded
with the start node and its direct dependencies, does four jobs at once:

- a shared ancestor of a diamond is reported once,
- the start node never appears as its own dependency,
- a node reachable both directly and through a longer path counts as direct only, so the two
  results never overlap,
- a cycle ends the walk instead of looping forever.

Ids that are not nodes of the graph are ignored. The result is ordered closest ancestor first.

**Why.** This is the part of the assignment that has a right and a wrong answer, so it is
isolated, has no dependencies, and is the most heavily tested file. BFS over an adjacency map is
the simplest thing that is correct; a general graph library would add concepts without adding
anything the problem needs. The cycle guard exists because the data comes from an API: a DAG is
the contract, not a guarantee.

For the mock graph:

```
A ──► B ──► D ──┐          Form D: direct = B          transitive = A
│               ├──► F     Form F: direct = D, E       transitive = A, B, C
└───► C ──► E ──┘          Form A: direct = none       transitive = none
```

### 3. Mapping state: `src/domain/mappings.ts`

**What.** `setMapping`, `clearMapping`, `getMapping`, plus `sourceId` and `formFieldSource`.

**How.** Mappings are `Map<formNodeId, Map<fieldKey, PrefillSource>>`. `setMapping` and
`clearMapping` return a new outer map and a new inner map for the one form that changed; every
other form keeps the same object. `sourceId` turns a source into a string with
`JSON.stringify([type, ownerId, key])`.

**Why.** Pure functions make the rules ("replacing keeps one entry", "clearing one field leaves
the others", "other forms are untouched") testable in a few lines and reusable from any state
container. `Map` instead of a plain object means a field called `constructor` or `toString`
cannot collide with an inherited property. JSON encoding instead of joining with a separator
means no character inside an id can make two different sources look the same.

### 4. API layer: `src/api/`

**What.** `types.ts` describes the part of the response the app reads. `blueprintClient.ts`
builds the URL and fetches. `normalizeBlueprint.ts` converts the response into a `Blueprint`.

**How.**

- The client builds `/api/v1/{tenant}/actions/blueprints/{id}[/{version}]/graph`, fetches it, and
  turns unreachable servers, error statuses and invalid response structure into errors with a
  message fit to show. `validateBlueprint.ts` checks the nested shapes the adapter reads,
  allowing unknown keys; it does not validate the entire published API contract.
- The adapter keeps only `form` nodes in the form list but keeps every node in the dependency
  map, so a chain through a non-form node is still followed. It reads each form's fields from
  the JSON Schema of its definition, labels them with the schema `title`, then the UI schema
  `label`, then the key, and sorts forms by name.
- It builds dependencies from `edges`, reading `source → target` as "target depends on source".
- After the client validates structure, the adapter tolerates inconsistent references. A
  dangling edge, a missing form definition, a duplicate node id or an input mapping it cannot
  interpret is dropped and described in
  `blueprint.warnings`, which the UI shows in a collapsible notice.

**Why.** One boundary means one place to change when the API changes, and it lets the rest of the
code assume clean data. Edge direction is the easiest thing to get backwards, so it is not
assumed: a test checks, on the real mock response, that each node's `prerequisites` are exactly
the sources of the edges that target it. There is no schema validation library because there is
one endpoint: consumed shapes are checked by hand and references are verified by the adapter.

### 5. Prefill sources: `src/prefill-sources/`

**What.** The extension point of the app.

```ts
interface PrefillSourceProvider {
  id: string; // unique, used in VITE_PREFILL_SOURCES
  label: string; // heading of its section in the picker
  getGroups(context: { blueprint: Blueprint; form: FormNode }): PrefillOptionGroup[];
}
```

A provider answers one question: for this form, which values can prefill a field? It answers
with groups (`Form B`, `Action Properties`) of options (`Email`, `Action name`), and every option
carries the `PrefillSource` to store.

**How.**

| File                  | Role                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `types.ts`            | The provider, group and option interfaces.                                                                    |
| `formDependencies.ts` | Two providers that call the graph functions and turn each upstream form's fields into options.                |
| `globalData.ts`       | A provider that ignores the graph and offers the properties of static data sets.                              |
| `registry.ts`         | `allPrefillProviders`, the single list of known providers, and `selectPrefillProviders` to pick a subset.     |
| `sections.ts`         | `buildSections` asks every provider and returns one section each; `indexOptions` and `filterSections` on top. |

`buildSections` is the only place providers are called. It checks every `form_field` source
against existing upstream fields, including sources returned by a custom provider such as saved
favorites. Other source types remain open for extension. Its output, `PrefillSection[]`, is plain
data, and it is all the UI ever sees.

**Why.** The components contain no `if (direct) … else if (global) …`. They render sections,
groups and options, so a new source shows up in the picker and on the field rows without any
component changing. Direct and transitive dependencies are two providers rather than one so that
each can be turned off on its own and so that the picker can label them separately.

One rule falls out of this design and replaces a whole category of validation code: **a stored
mapping is valid for a form exactly when its source is among the options on offer for that
form.** A mapping that points at a form which is no longer upstream, at a field that was removed,
or at a provider that was switched off simply does not resolve, and the row shows it as
"Unavailable source" with the option to replace or clear it. Lookup is by source id, never by
label, so "Email" of Form A can never stand in for "Email" of Form B.

### 6. Hooks: `src/hooks/`

**What.** `useBlueprint(request)` returns `{ state, retry }` where `state` is `loading`, `error`
or `ready`. `usePrefillMappings(initial)` returns the mappings and stable `setMapping` /
`clearMapping` callbacks.

**How.** `useBlueprint` fetches in an effect with an `AbortController`. It stores the outcome
together with the request it belongs to and derives "loading" from whether the stored outcome is
for the current request. Each URL transition gets a new identity, so a quick A → B → A switch
also loads again instead of reusing a stale outcome. `usePrefillMappings` is `useState` plus the
pure functions from the domain, called through functional updates.

**Why.** Deriving the loading state means a new request can never show the previous one's data
and there is nothing to reset by hand. Aborting on cleanup drops stale answers, including the
duplicate request React's StrictMode makes in development. Functional updates mean the callbacks
never close over an old copy of the mappings. No data-fetching library and no state library:
there is one GET and two pieces of state.

### 7. Components: `src/components/`

```
App                       loads the blueprint; renders loading / error / the workspace
└─ BlueprintWorkspace     owns the selected form and the mappings
   ├─ FormList            navigation: one button per form
   └─ PrefillEditor       one form: asks the providers once, renders rows, opens the picker
      ├─ FormDependencies "Depends directly on … / indirectly on …"
      ├─ PrefillFieldRow  one field: its source, or "Select source"; the X to clear
      └─ SourcePickerDialog  the modal: search, sections, groups, options
```

**How.**

- `BlueprintWorkspace` is only mounted once the blueprint has loaded, so its state starts from
  the blueprint and no effect has to keep the two in sync. The selected form is derived (the
  chosen id, or the first form) rather than stored.
- `PrefillEditor` is rendered with `key={form.id}`, so switching forms resets its local state.
  It calls `buildSections` once and uses the result twice: to describe the mappings that exist
  and to fill the picker.
- `PrefillFieldRow` uses a single `<button>` for all three states (empty, mapped, unavailable).
- `SourcePickerDialog` is a native `<dialog>` opened with `showModal()`. Options are native radio
  inputs grouped in `<fieldset>`s. **Select** stays disabled until the choice differs from the
  current mapping.

**Why.**

- State lives in the lowest component that needs it, and is passed down as props. With two levels
  there is nothing for context or a store to solve.
- The native dialog gives the focus trap, Escape, the inert background and focus return for free
  and accessibly. Native radios give arrow-key navigation across all options.
- The single button matters for focus: when the picker closes, the browser returns focus to the
  element that opened it, which only works if that element still exists after the mapping
  changed.

## Adding a new data source

Two steps, no component changes.

**1. Write a provider.** For example, properties of the signed-in user:

```ts
// src/prefill-sources/currentUser.ts
import type { PrefillSourceProvider } from './types';

export const currentUserProvider: PrefillSourceProvider = {
  id: 'current-user',
  label: 'Current user',
  getGroups: () => [
    {
      id: 'profile',
      label: 'Profile',
      options: [
        { source: { type: 'user', ownerId: 'current', key: 'email' }, label: 'Email' },
        { source: { type: 'user', ownerId: 'current', key: 'full_name' }, label: 'Full name' },
      ],
    },
  ],
};
```

**2. Register it** in `src/prefill-sources/registry.ts`:

```ts
export const allPrefillProviders: readonly PrefillSourceProvider[] = [
  directDependenciesProvider,
  transitiveDependenciesProvider,
  globalDataProvider,
  currentUserProvider,
];
```

It now has its own section in the picker, can be searched, can be selected, is shown on the
field row, and can be switched on or off with `VITE_PREFILL_SOURCES=…,current-user`.

Things to know when writing one:

- **`getGroups` receives the blueprint and the form being configured**, so a provider can depend
  on the graph (as the dependency providers do) or ignore it (as global data does).
- **`getGroups` must be pure and synchronous.** It runs during render. A source that needs
  fetched data should fetch it first and then build the provider from the result, the way
  `createGlobalDataProvider(dataSets)` builds one from a list of data sets.
- **The `source` triple is the identity.** Pick a `type` that is yours and make `ownerId` + `key`
  unique within it. If two providers return the same source, the earlier one in the list keeps it.
- **Only different data, same shape?** Skip step 1 and call `createGlobalDataProvider` with your
  own data sets.

`App` also takes a `providers` prop, which is how the tests exercise custom combinations.

## Tests

```bash
npm test
```

168 tests in 11 files, run with Vitest and React Testing Library.

| File                             | What it proves                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/graph.test.ts`           | Direct and transitive dependencies; chains; branching; diamonds; independent graphs; unknown ids; self-loops; cycles; no dependence on declaration order.            |
| `domain/mappings.test.ts`        | Set, replace, clear; immutability; other forms untouched by identity; source ids that cannot collide; prototype-named keys.                                          |
| `api/normalizeBlueprint.test.ts` | The real mock response end to end; edge direction against `prerequisites`; both API naming variants; malformed references; reading stored input mappings.            |
| `api/blueprintClient.test.ts`    | URL building; error status, unreachable server, malformed nested response shapes, real mock acceptance, aborts.                                                      |
| `prefill-sources/*.test.ts`      | Each provider; every combination and order; a provider added later; identity across forms that share a definition; unresolvable sources; search; provider selection. |
| `hooks/useBlueprint.test.ts`     | Abort on request change/unmount; late responses; fresh loading on A → B → A even when B is pending.                                                                  |
| `App.test.tsx`                   | The app as a user sees it: load, select a form, open the picker, add, replace, clear, cancel, switch forms, stored and stale mappings, error and retry, empty.       |

How they are written:

- **Only the network is mocked.** UI tests render the real `App` and replace `fetch`.
- **The fixture is real.** `src/test/fixtures/mock-server-graph.json` is a byte-for-byte copy of
  the mock server's `graph.json`.
- **Queries go through roles and accessible names**, so the tests also hold the markup to
  account.
- jsdom does not implement the modal methods of `<dialog>`. `src/test/setup.ts` supplies small
  stand-ins for `showModal()` and `close()`. Escape, the focus trap and outside click cannot be
  simulated there; those were verified in a real browser (Chromium, at 1280px and 390px).

## Design decisions and trade-offs

| Decision                                            | Why                                                                                                         | The cost                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Dependencies come from `edges`, not `prerequisites` | The schema documents edges as the dependencies between components. The two agree in the mock data (tested). | If a real response ever had them disagree, edges win silently.                  |
| A form is its node id, never its form definition id | Four of the six mock nodes share one definition.                                                            | None.                                                                           |
| "Direct" means one edge away                        | Simple and matches the graph.                                                                               | A form reached through a non-form node (a branch, say) is listed as transitive. |
| Providers are synchronous                           | The interface stays three members and the UI needs no loading state per source.                             | A source backed by an API has to load its data before the provider is built.    |
| No type compatibility between source and target     | The assignment and schema define no such rule. Field types are kept on fields and options for when one is.  | You can map a checkbox group onto a text field.                                 |
| Own `useBlueprint` hook instead of TanStack Query   | One GET, no cache, no mutation: about 40 lines.                                                             | A second endpoint or a save call would justify switching.                       |
| `useState` + props instead of context or a store    | Two pieces of state, two levels deep.                                                                       | A much deeper tree would want context.                                          |
| Native `<dialog>` instead of a modal library        | Accessible behaviour from the platform, no dependency.                                                      | jsdom cannot test its modality (see [Tests](#tests)).                           |
| Forms sorted by name                                | The API's node order is arbitrary; names are how users look for forms.                                      | Not a topological order.                                                        |
| Tailwind, no component library                      | A handful of components; utility classes keep styles next to markup.                                        | Long class strings.                                                             |
| ESLint 10 without `eslint-plugin-jsx-a11y`          | The plugin does not support ESLint 10 yet and ESLint 9 is end of life.                                      | Accessibility is enforced by role-based tests instead of lint rules.            |

## What the API actually returns

Worth knowing before extending this, because the mock server and the published OpenAPI document
differ in places. The mock GET, 404 for writes and versioned URLs, and fixture contents were
independently verified against the running server. The published-schema notes below could not
be rechecked during the final audit because the docs returned HTTP 403; verify those details
before using the production API.

- **Path.** The mock serves `/api/v1/{tenant}/actions/blueprints/{id}/graph`. The published API
  adds a `{blueprint_version_id}` segment, which the mock answers with 404. The client supports
  both.
- **Names.** The mock returns `id` and `name`; the published schema calls them `blueprint_id` and
  `blueprint_name`. The adapter accepts both.
- **Writes.** The published API has a `PUT` on the same path that takes the whole graph and an
  `If-Match` ETag. The mock answers every non-GET with 404.
- **Edges.** `source` is the prerequisite and `target` the dependent.
- **Fields** are the `properties` of a form definition's `field_schema`. Two of the eight have no
  `title`; their label is only in `ui_schema`.
- **`input_mapping`** is `{}` on every node of the mock. The schema defines its values as a union
  of more than thirty expression types and does not say which one a prefill writes. The adapter
  reads the one that unambiguously addresses a value of another component,
  `action_component_data` (`component_key` + `output_key`), as a form-field prefill. This is an
  assumption, isolated in `toPrefillSource` in `normalizeBlueprint.ts`. Any other expression is
  reported and not shown.

## Known limitations

- **Edits are not saved.** They live in memory and are lost on reload. The mock server has no
  write endpoint, and there is no serialiser for the real `PUT` because the expression format
  could not be verified for anything but form fields.
- **Global data is example data.** The two data sets in `globalData.ts` are static. The graph
  endpoint describes no global data and the brief leaves its content open.
- **One blueprint per page load**, chosen by environment variables. There is no blueprint picker.
- **The picker renders every option.** Fine for hundreds; thousands would want virtualisation.
- **Outside click closes the picker only where `closedby` is supported.** Elsewhere Escape, Cancel
  and the close button still work.
- **No browser suite in CI.** The UI tests run in jsdom. The original implementation was
  manually checked in Chromium; the final audit could not repeat that check because headless
  Chromium exited at launch. Native Escape, focus trapping, light dismiss and responsive layouts
  still need a browser check. Firefox and Safari have not been verified.
