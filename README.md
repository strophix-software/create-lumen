# create-lumen

A scaffolder that generates production-ready **React + Vite** or **Next.js** projects (App Router / Pages Router), with a choice of architecture: feature-based, type-based, hybrid, or none.

Note: this repository is the CLI scaffolder itself, not a generated app. Generated projects live in the target folder you create.

## Quick usage

From npm (recommended):

```bash
npm create lumen my-app
cd my-app
npm run dev
```

> The v2 line (React + Vite + Next.js, manifest v2) is available on the `beta` dist-tag while v2 is in prerelease: `npm create lumen@beta my-app`.

### Non-interactive flags

Quick Setup (TypeScript + Tailwind + Feature-based + Router + ESLint + Prettier + Vitest), no prompts:

```bash
npm create lumen my-app -- -y
# or
npm create lumen -- -y my-app
# or
npm create lumen my-app -- --yes
```

Scaffold using a template preset (`react-ts`, `react-js`, `react-type-ts`, `react-type-js`, `next-ts`, `next-js`, `next-pages-ts`, `next-pages-js`):

```bash
npm create lumen my-app -- --template react-ts
# or
npm create lumen my-app -- -t next-ts
```

Choose framework and architecture directly:

```bash
npm create lumen my-app -- --framework react --arch none

# Next.js — the router is asked interactively (App Router recommended):
npm create lumen my-app -- -f next
# ...or pin the variant outright:
npm create lumen my-app -- -f next:app-router
npm create lumen my-app -- -f next:pages-router
```

Interactively, the framework is the first prompt (React + Vite / Next.js), followed by a router step when Next.js is selected; every later option gates on that choice.

Drive scaffolding directly from a manifest file or inline JSON (manifest v2):

```bash
# From file
npm create lumen my-app -- --manifest ./lumen.config.json

# From inline JSON
npm create lumen my-app -- -m '{"manifestVersion":2,"framework":{"name":"react","variant":"vite"},...}'
```

The CLI parses options cleanly regardless of flag ordering, so flags can appear before or after the project name.

Display help and version:

```bash
npm create lumen -- --help
npm create lumen -- --version
```

Run the scaffolder locally (development / testing the generator):

```bash
node bin/cli.js           # run interactively
npm install
npm link                 # install globally for testing
create-lumen my-app      # after npm link
```

## Features

- **Two frameworks:** React + Vite (SPA) or Next.js (App Router / Pages Router) — selected interactively or via `-f`
- Architecture choice: feature-based, type-based, hybrid, or none (per-framework availability)
- TypeScript or JavaScript output
- CSS frameworks: Tailwind CSS v4 (CSS-first `@theme`, v3 dropped) or none
- **UI kit: shadcn/ui** (gated to Tailwind; primitives + `cn` helper land in the mapped `paths.ui`)
- Optional state management: Zustand or Redux Toolkit
- Optional router (React Router — Vite only; Next.js uses filesystem routing)
- Optional testing: Vitest or Jest (Next.js defaults to none until a Next-native overlay is verified)
- **Next.js-native overlays:** server/client boundary demos + `no-server-imports-in-client` ESLint rule, `next/font` (Geist), `next/image`, filesystem routing examples, route handlers (`route.ts`) / API routes (`pages/api`)
- **Next.js options:** `bundler: turbopack|webpack`, `adapter: node|vercel|cloudflare|static` (`next.config` overlays), `reactCompiler`, `linter: biome` — all validated against the capability model
- Linting: ESLint (default), Oxlint, or Biome
- Code formatter: Prettier or Oxfmt (chosen after the linter; `eslint-config-prettier` is auto-wired for the ESLint + Prettier combo)
- Manifest v2: Emits a deterministic `lumen.config.json` validated against JSON Schema Draft 2020-12, including architecture validation modes and harness command configuration.
- Explicit path mapping: Target directories declared for `lumen-cli` code generation
- Optional Axios setup and icon libraries
- Auto `git init`, generated `README` (with a project description reflecting the chosen tooling) and `LICENSE`
- `.env.example` scaffolded, and the generated `.gitignore` excludes env files (`.env`, `.env.*`) while keeping `.env.example`
- `@/` path alias configured (`tsconfig`/`jsconfig` + Vite)
- **Agent docs:** optional `.lumen/` context directory (project, architecture, conventions) via prompt or `--agent-docs`

Your selected options are cached and offered as defaults on subsequent runs.

## Developing the scaffolder

- Entry point: `bin/cli.js` → `src/main.js` (ESM-only)
- Templates: `templates/` (architectures + conditional overlays)
- Injector copies architecture, then overlays conditionals based on choices
- Config cache: `~/.lumen-config.json` stores previous choices
- This tool uses Node >= 18 and `execa` for subprocesses

Run locally (interactive):

```bash
node bin/cli.js
```

Install globally for testing:

```bash
npm link
create-lumen my-app
```

## Testing the scaffolder

The CLI repo has no app-level test suite, but `npm test` runs the unit tests under `tests/unit/` plus the offline smoke tests under `tests/smoke/`, and two harnesses in `tests/e2e/` and `tests/smoke/` drive the real generator against generated scaffolds. See `docs/tests/README.md` (and `harness.md`) for details, scope, and what they verify.

```bash
npm test                                    # unit (tests/unit/) + offline smoke (tests/smoke/generate.test.mjs)
node --import ./register.js tests/smoke/install.mjs  # real-install smoke (Quick Setup default; needs network)
node --import ./register.js tests/e2e/exhaustive.mjs # full option matrix (~11,664 combos, local-only; ~13 min). Use LIMIT=n.
```

## Project structure (generated app examples)

Feature-based (example):

```
src/
├── app               # App shell and global providers
│   ├── App.tsx
│   ├── contexts
│   │   └── themecontext.ts   # createContext + ThemeContextValue
│   ├── providers
│   │   └── ThemeProvider.tsx # Provider component
│   ├── hooks
│   │   └── useTheme.ts       # Hook that reads ThemeContext
│   └── router        # Data router (per feature area)
│       ├── guards    # AuthGuard, RoleGuard
│       ├── routes    # home.routes, auth.routes
│       └── index.tsx # createBrowserRouter init
├── features           # Feature modules (business logic owned per feature)
│   └── home
│       ├── components
│       ├── hooks
│       ├── index.ts    # public feature barrel
│       ├── layouts
│       ├── pages
│       ├── services
│       ├── store
│       └── types
└── shared             # Reusable, business-agnostic resources
    ├── api/lib        # fetch client → api/; axios init → lib/axios/ (per choice)
    ├── components
    │   └── ui
    ├── hooks
    ├── layouts
    ├── stores
    ├── styles
    │   ├── globals.css      # Tailwind directives (or main.css for vanilla)
    │   └── themes.css       # Theme tokens (Tailwind @theme / CSS vars)
    ├── types
    └── utils
```

Type-based (example):

```
src/
├── App.tsx
├── components
│   ├── common
│   └── form
├── config             # API config (when an axios/fetch client is chosen)
├── layouts
├── main.tsx
├── pages
├── providers          # Provider components (createContext + Provider in separate files inside providers/)
│   ├── appcontext.ts      # createContext + AppContextValue
│   └── AppProvider.tsx    # Provider component
├── hooks
│   └── useApp.ts           # Hook that reads AppContext
├── router             # Centralized data router
│   ├── guards         # AuthGuard, GuestGuard
│   └── index.tsx      # Single source of truth for all routes
├── services
├── store
├── styles
│   ├── globals.css      # Tailwind directives (or main.css for vanilla)
│   └── themes.css       # Theme tokens (Tailwind @theme / CSS vars)
├── test
└── utils
```

## Manifest v2 & Ecosystem Architecture

`create-lumen` is part of the Lumen ecosystem alongside **`lumen-cli`**:

- **`create-lumen` (this repo):** The bootstrap scaffolder that initializes project repositories and writes an explicit, strictly validated `lumen.config.json` manifest (`manifestVersion: 2`) into the project root. The manifest is **optional but highly recommended** for full editor integration and agent interoperability. If omitted, `lumen-cli` will attempt to infer a basic configuration, but advanced features (like configurable harness and architecture validation) require the manifest.
- **`lumen-cli`:** The companion developer CLI that reads `lumen.config.json` to generate components, features, hooks, services, and run diagnostics (harness and doctor) at the paths declared in `manifest.paths`. It also provides commands to inspect and update the manifest.

### Manifest v2 Schema (v2.0.0-alpha.1+)

The manifest now includes:
- **`architecture.preset`**: The base architecture (`feature-based`, `type-based`, `hybrid`, `none`).
- **`architecture.validation`**: Validation mode for `lumen doctor` (`strict`, `relaxed`, `none`).
- **`harness.commands`**: An array of commands to run with `lumen harness` (e.g., lint, format, types, test, build), each with a name, shell command, required flag, and description.

### Ecosystem Documentation & Contracts

- **[Documentation Index](./docs/README.md):** Complete overview of specifications, ADRs, and developer guides.
- **[Next.js App Router Guide](./docs/next-app-router.md):** App Router scaffold, filesystem routing, route handlers, server/client boundaries, `next/font` and `next/image`.
- **[Next.js Pages Router Guide](./docs/next-pages-router.md):** Pages Router scaffold, API routes, `_app`/`_document` wiring.
- **[Deployment Adapters Guide](./docs/next-adapters.md):** Adapter matrix (Node, Vercel, Cloudflare, static), bundler choice and Biome setup for Next.js.
- **[Generator Engine & Capabilities Guide (M2)](./docs/engine-capabilities.md):** Capability model, template composition, shadcn/ui on Tailwind v4, architecture presets, and Bootstrap removal.
- **[Manifest v2 Overview](./docs/manifest-v2.md):** Specification of the nested schema, validation behavior, and the new harness and architecture validation fields.
- **[Shared Contract: `create-lumen` ↔ `lumen-cli`](./docs/contracts/manifest-v2-contract.md):** The agreed contract for path mapping, barrel conventions, version negotiation, and the harness/configuration interface.
- **[v1 to v2 Migration Guide](./docs/migration/v1-to-v2.md):** Complete guide for migrating generated projects and legacy flat configs to v2.

### Agent Interoperability

Lumen is designed for both people and agents. When `agentDocs: true` is set in the manifest (or via the `--agent-docs` flag), `create-lumen` generates a `.lumen/` directory in the project root containing:
- `project.json`: The resolved manifest.
- `architecture.json`: The effective architecture preset and validation mode.
- `conventions.md`: A markdown file documenting project-specific conventions (e.g., component naming, file organization).
These files enable agents to understand the project without parsing the source code.

## Roadmap & Planning

- **Changelog:** Notable changes are documented in [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (Keep a Changelog format).
- **Roadmap:** Milestones (M1 through M5) are tracked in [`docs/ROADMAP.md`](./docs/ROADMAP.md).
- **Visual Plan:** Dependency graphs and parallel wave execution plans live in [`docs/PLAN.md`](./docs/PLAN.md).
- **Branching Workflow:** Guide for branch conventions and PR checklist in [`docs/BRANCHING.md`](./docs/BRANCHING.md).

## Requirements

- Node.js >= 18

## Acknowledgements

This project is based on [create-vrtw](https://github.com/Avijit07x/create-vrtw) by [@Avijit07x](https://github.com/Avijit07x). Thank you for the original work that inspired this scaffolder.

## License

MIT
