# Journey Builder

A **React + TypeScript prefill configuration editor** for the [Avantos Journey Builder challenge](https://app.notion.com/p/Journey-Builder-React-Coding-Challenge-3e7e7901ef2483c5b5b2816a5760119e).

Load a blueprint graph, select a form, and choose where each field gets its initial value. This edits **source references**, not submitted form values.

| Form editor | Source picker |
| :---: | :---: |
| ![Form prefill editor](docs/editor.png) | ![Prefill source picker](docs/picker.png) |

## Features

- Browse forms and their direct/transitive dependencies.
- Add, replace, and clear field mappings.
- Choose sources from **direct ancestors**, **transitive ancestors**, or **global data**.
- Search sources and identify unavailable mappings.
- Configure provider combinations; add new sources without changing UI components.
- Accessible controls with loading, empty, and API error states.

## Quick start

Requires **Node.js 22.13+ (22.x), 24.x, or 26+**.

```bash
git clone https://github.com/Reckless98/journey-builder-prefill.git
cd journey-builder-prefill
npm ci

# One-time setup: official read-only mock API, ignored by this repo
git clone https://github.com/mosaic-avantos/frontendchallengeserver.git frontendchallengeserver

npm run start
```

Open **http://127.0.0.1:5173**. The same command starts the official mock API on **http://127.0.0.1:3000**. Press **Ctrl+C** to stop both. Ports 5173 and 3000 must be free.

## Architecture

```text
Mock API → validate & normalize → Blueprint (forms + DAG)
                                      ↓
                           source providers → picker
                                      ↓
                          React state → field mappings
```

Responsibilities are separated into **API** (`src/api`), **domain logic** (`src/domain`), **source providers** (`src/prefill-sources`), **hooks** (`src/hooks`), and **UI** (`src/components`).

See [Architecture & extensibility](docs/ARCHITECTURE.md) for the data flow, provider example, and design decisions.

## Configuration & tests

Defaults work with the mock. See [`.env.example`](.env.example) for optional API settings and `VITE_PREFILL_SOURCES` (e.g. `global-data,direct-dependencies`).

```bash
npm run check  # typecheck, lint, format, tests, production build
npm test       # Vitest only
```

Tests cover DAG traversal, mappings, API validation, providers, and React interactions. GitHub Actions runs `npm run check` on pull requests and main.

## Scope

Mapping edits live **in browser memory**; a refresh reloads API configuration. The official mock supports GET only, so persistence and journey execution are outside this challenge. Global properties are illustrative. Separate real-browser tests covered Chromium; they are not part of GitHub CI.
