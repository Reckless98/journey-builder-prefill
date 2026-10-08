# Architecture & extensibility

Technical notes for reviewers of the [Journey Builder](../README.md) submission.

## Responsibilities

| Location | Purpose |
| --- | --- |
| `src/api/` | Build/fetch the graph URL, validate JSON, normalize nodes and definitions |
| `src/domain/` | Domain types, upstream DAG traversal, immutable mappings |
| `src/prefill-sources/` | Direct/transitive/global providers, registry, source filtering |
| `src/hooks/` | Fetch/abort/retry lifecycle; editable mapping state |
| `src/components/` | Form navigation, editor, field rows, native source-picker dialog |
| `src/config.ts` | API settings and provider selection via `VITE_*` variables |
| `scripts/start-mock.mjs` | Start the unchanged official mock on loopback |

## From API to UI

1. `useBlueprint` calls `fetchBlueprintGraph` and aborts superseded requests. The client handles HTTP errors and validates the response shape consumed by the app.
2. `normalizeBlueprint` joins graph nodes with reusable form definitions, extracts fields, imports supported mappings, and builds a dependency map from edges. Missing/unsupported data produces warnings where applicable.
3. `BlueprintWorkspace` owns the selected **form node ID** and editable mappings. Multiple graph nodes may reuse one definition, so a definition ID cannot identify a journey step.
4. `PrefillEditor` calls `buildSections`. Active providers supply options; the composition layer rejects non-upstream form fields and deduplicates sources.
5. The dialog stores an **unconfirmed draft**. Confirming invokes immutable `setMapping` through `usePrefillMappings` and React renders the change; Cancel/Escape do not commit.

A mapping stores a **source reference**, not a value:

```ts
{ type: 'form_field', ownerId: '<form node ID>', key: 'email' }
```

`sourceId` identifies sources using the serialized `[type, ownerId, key]` tuple. `clearMapping` removes only the selected field mapping.

## Directed graph rules

An edge `A → B` means B depends on A. In `A → B → D`, B is **direct** and A is **transitive** for D. The domain traverses upstream using breadth-first search and a visited set to avoid duplicates and terminate even for cyclic input. Direct ancestors are excluded from transitive results.

Only upstream **form fields** can be used as form-field sources. Global sources are independent of the graph.

## Adding a provider

Providers return plain groups/options. The picker does not branch on source types. For example, create `src/prefill-sources/currentUser.ts`:

```ts
import type { PrefillSourceProvider } from './types';

export const currentUserProvider: PrefillSourceProvider = {
  id: 'current-user',
  label: 'Current user',
  getGroups: () => [
    {
      id: 'profile',
      label: 'Profile',
      options: [
        {
          source: { type: 'user', ownerId: 'current', key: 'email' },
          label: 'Email',
        },
      ],
    },
  ],
};
```

Register it in `allPrefillProviders` in `src/prefill-sources/registry.ts`. The React components need no changes. `getGroups({ blueprint, form })` must be **synchronous and pure**; preload external data before passing it to a provider. Keep `type`, `ownerId`, and `key` stable.

Use `VITE_PREFILL_SOURCES` with comma-separated provider IDs to select/order any registered subset; unset means all providers. Duplicate options are offered only once, under the first matching provider.

## Testing & limitations

- `npm run check` runs TypeScript, ESLint, Prettier, Vitest, and production build, and is used by CI.
- Automated tests cover graph shapes, mappings, validation, source combinations, request races, and UI interactions.
- jsdom does not fully support native `<dialog>` behavior. Real Chromium tests exercised keyboard/focus/dismissal separately; Firefox, WebKit, and physical screen readers were not verified.

The official mock is **read-only**. Edits remain in React memory; reload restores API-provided configuration. Real saving would require an API write flow and serialization into supported `input_mapping` expressions. The adapter supports a subset of those expressions; the official mock starts without mappings. Global data is illustrative, as the challenge permits.

The picker renders matching options without virtualization. For substantially larger graphs, virtualization and more efficient search would be sensible follow-ups.
