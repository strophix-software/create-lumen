# Changelog

All notable changes to `create-lumen` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0-beta.6] — 2026-10-27

### Fixed

- **Omit `middleware.ts` in Next.js 16 when `proxy.ts` is generated** (#70) — Next.js 16.4+ (Turbopack) throws a fatal error if both `middleware.ts` and `proxy.ts` are detected. Route groups preset now exclusively emits `src/proxy.ts` / `src/proxy.js` with `proxy` and `config` exports and cleans up any conflicting `middleware` files.
- **Prevent redundant folder nesting (`project/project`) in destination directory** (#71) — When the current working directory is empty and matches the project name, or when the user passes `.`, scaffolding writes directly into the root directory instead of creating a redundant nested subfolder.
- **Kebab-case casing for UI components & path aliases in `tsconfig.json`** (#72) — Renamed primitive UI components to kebab-case (`button.tsx`, `card.tsx`) to match shadcn and `@lumen` registries, and configured TypeScript path aliases (`@/components/*`, `@/ui/*`, `@/lib/*`, `@/hooks/*`) matching `components.json` across architectures.

## [2.0.0-beta.3] — 2026-10-26

### Added

- **Official `@lumen` registry in `components.json` for Shadcn Registry v2** (#69) — automatically configures `registries: { "@lumen": "https://raw.githubusercontent.com/strophix-software/lumen-registry/main/public/r" }` in `components.json` for both Next.js and React/Vite, enabling 100% interoperability with `lumen-cli` (`lumen g ui <name>`) and standard Shadcn CLI (`npx shadcn@latest add @lumen/<block>`).
- **Supabase provider support for Prisma ORM in Next.js** — added `--database prisma` with `provider: "supabase"` support, configuring dual connections (`DATABASE_URL` for Supavisor transaction pooler on port 6543 with `?pgbouncer=true`, and `DIRECT_URL` for direct session connection on port 5432), updated `prisma/schema.prisma` with `directUrl`, and `.env.example`.
- **Command shortcuts in `package.json`** — wired `format` (`"biome check --write ."`) and `format:check` (`"biome check ."`) when Biome is selected without Prettier, and added `"test:watch"` for Vitest aligning with Jest.

### Changed & Refactored

- **Purged `hybrid` architecture across the entire ecosystem** — removed `hybrid` preset from manifest v2 schema (`ARCHITECTURE_TYPES`), CLI options, templates, capabilities, and documentation. Architecture choice is now cleanly scoped: React (`feature-based`, `type-based`, `none`) and Next.js (`feature-based`, `none`).
- **Next.js canonical manifest paths** — updated `manifest.paths.pages` to resolve to `"src/app"` (App Router) and `"src/pages"` (Pages Router) instead of root `"app"` / `"pages"`.
- **Biome v2 schema upgrade & Tailwind directives** — upgraded `biome.json` to schema `https://biomejs.dev/schemas/2.0.0/schema.json` with `css.parser.tailwindDirectives: true` and canonical formatting on scaffolding.
- **Modern Next.js Flat ESLint configuration** — updated Next.js ESLint configuration to flat config `eslint.config.mjs` with `FlatCompat` instead of deprecated `.eslintrc.json`.
- **CLI flag enhancements** — supported `--formatter` (including `--formatter none`), `--linter` (`-l`), and `--css` (`-c`) flags with automatic prompt bypassing and response overlays.

### Fixed

- **Purged `App.*` file leakage in Next.js minimal `none` architecture** — prevented template leakage of Vite `App.tsx`, `App.jsx`, and `App.css` in Next.js scaffolds.
- **Pinned Prisma to v6** — updated Prisma dependencies to `^6.0.0` for Node 20+ engine compatibility.
- **Dynamic harness test command** — dynamically resolves harness test command in `lumen.config.json` based on the selected test runner (`vitest` vs `jest`).
- **Prevented Vite configuration leakage in Next.js** — suppressed Vite configuration overlays and scripts (`preview`) when scaffolding Next.js projects.

## [2.0.0-beta.2] — 2026-10-26

### Added

- **Fullstack Next.js Prisma ORM and database scaffolding** (#62) — `--database prisma` flag and manifest capability support (`sqlite`, `postgresql`, `mysql`, `sqlserver`, `cockroachdb`, `mongodb`); generates `prisma/schema.prisma`, singleton database client (`src/lib/db.ts` or `src/shared/lib/db.ts`), seed script, package scripts (`db:generate`, `db:push`, `db:migrate`, `db:seed`), and `DATABASE_URL` environment variables.
- **Next.js multi-stage Docker & docker-compose standalone** (#63) — `--docker` flag and manifest capability; scaffolds multi-stage production Dockerfile targeting Next.js `output: "standalone"`, `.dockerignore`, `docker-compose.yml`, and automatically injects `output: "standalone"` into `next.config.ts` / `next.config.mjs` / `next.config.js`.
- **Next.js Route Groups preset & Auth Proxy** (#64) — `--route-groups` preset scaffolds segregated App Router directory structure: `(public)`, `(auth)` with login/register pages, `(private)` with dashboard, and `(admin)`. Includes auth proxy edge middleware (`src/proxy.ts` / `src/middleware.ts`) enforcing authenticated route protection.
- **Root `AGENTS.md` Single Source of Truth & Component Taxonomy** (#67) — replaces redundant `.lumen/` directory with root `AGENTS.md` referencing `lumen.config.json` as the sole contract. Includes the official Next.js warning block verbatim (`"This is NOT the Next.js you know..."`) and formalizes the 3-tier component taxonomy contract across `create-lumen` and `lumen-cli`:
  1. Atomic UI primitives (`paths.ui`): `@/shared/components/ui` or `@/components/ui`.
  2. Compound components (`paths.components`): `@/shared/components` or `@/components`.
  3. Feature domain components (`paths.features/<feature>/components`): `@/features/<feature>/components`.

### Fixed

- **Strict Zero-Babel policy for Next.js with Jest** (#65) — eliminates `babel.config.cjs` when Jest is selected on Next.js, adopting native Next.js SWC compilation via `next/jest.js` (`createJestConfig`), preventing Turbopack and `next dev` crashes.
- **Removed Vite-specific dependencies & adapted overlays for Next.js** (#66) — adapted Vitest config on Next.js to run without `@vitejs/plugin-react`, and migrated API client overlays from `import.meta.env` to `process.env.NEXT_PUBLIC_API_URL`.
- **Prevented internal `.provenance.json` leakage** (#68) — excluded internal snapshot provenance metadata from copying into user-generated projects.
- **Purged React SPA application layer from Next.js root `src/app/`** — removed `App.tsx`, `contexts/`, and `providers/` pollution from Next.js App Router root, consolidated hooks to `src/shared/hooks/` as the single shared hooks source, and eliminated `src/app/` from Pages Router scaffolds.

## [2.0.0-beta.1] — 2026-10-26

### Added

- **Next.js support — App Router + Pages Router** (#8, #18, #19) — framework selection is now the first interactive prompt, followed by a router step for Next.js; flags: `-f next` (asks router), `-f next:app-router`, `-f next:pages-router`. Repository-owned bases vendored from pinned `create-next-app@16.3.8` (dev-time only, per-base `.provenance.json`, ADR 0001) under `templates/bases/next/{app-router,pages-router}/{ts,js}`; `main()` scaffolds Next via the provider registry (`scaffoldBase`) instead of shelling out.
- **Filesystem routing + route handlers** (#20) — App Router: `app/blog/[slug]`, `app/api/hello/route.ts`, `loading`/`not-found`; Pages Router: `pages/blog/[slug]` (getServerSideProps), `pages/api/hello`, custom 404/500. `next build` green on both routers and both languages.
- **Server/client boundaries + `next/font` + `next/image`** (#21) — overlays under `templates/conditional/next/{server-components,font,image}`: `"use client"` boundary demos with a `no-server-imports-in-client` ESLint rule, Geist via `next/font` wired into the app layout and pages `_document`, `next/image` examples for both routers.
- **Adapter, bundler and tooling options** (#22) — `adapter: node|vercel|cloudflare|static` and `bundler: turbopack|webpack` applied as `next.config.{ts,mjs}` overlays, `reactCompiler` flag, `linter: biome` with `biome.json`; all gated by `validateCompatibility` / `isPromptVisible`.
- **Interactive: UI kit prompt** — shadcn/ui selectable when Tailwind is chosen, skipped otherwise; shown in the configuration summary.
- **Interactive: agent docs prompt** — `.lumen/` agent context now selectable in the flow (previously flag-only).
- **Presets: `next-ts`, `next-js`, `next-pages-ts`, `next-pages-js`**.
- **Docs: Next.js guides** (#49) — `docs/next-app-router.md`, `docs/next-pages-router.md`, `docs/next-adapters.md` (deployment adapter matrix), and a Next.js section in `docs/migration/v1-to-v2.md`.

### Changed

- **Next.js testing default is `none`** — `create-next-app` ships no runner and no Next-specific test overlay is verified yet; Vitest and Jest remain explicitly selectable.
- **Next providers reconciled to `next ^16`** to match the vendored bases (`^15` was stale).

### Fixed

- **`-f/--framework` was parsed but dropped** between `bin/cli.js` and `main()`, so the flag never reached the prompts.
- **`computeDeps` never matched Next.js dependency paths** — it checked a `framework` string that was never set; it now reads `frameworkName`/`framework` and the Biome linter installs `@biomejs/biome`.
- **`configureProject` overwrote Next base scripts with Vite commands** (`dev`, `build`, `preview`) — scripts are now filled only when missing, preserving base and overlay scripts.
- **Manifest emission failed on `adapter: "none"`** — non-concrete adapters are no longer written to `framework.adapter`.
- **`@types/node` peer conflict with Vitest** on Next.js TS bases — bumped to `^22` (Vitest requires `^22 || >=24`).
- **Windows mojibake in interactive output** — double-encoded `•`, `—` and `←` sequences in `src/prompts.js` repaired.

## [2.0.0-alpha.2] — 2026-10-02

### Added

- **Engine: gate prompts by declared capabilities** (#26) — `src/prompts.js` reads `src/engine/capabilities.js` instead of hardcoded framework branches; invalid combinations are unselectable, Next.js hides the router prompt, React/Vite flow unchanged.
- **Engine: template fragment composition** (#27) — `src/engine/composition.js` composes capability-scoped fragments with documented 5-layer precedence (base → framework → arch → styling → tooling, `docs/template-fragment-composition.md`); `src/injector.js` works from the composed fragment list with byte-identical React/Vite output.
- **UI: shadcn/ui support gated to Tailwind v4** (#33) — `templates/ui/shadcn/` fragments (`cn` helper, Button/Card primitives), generated `components.json` with aliases, `injectUiKit` in `src/injector.js`.
- **Architecture: `none` + `hybrid`** (#34) — flat `src/` scaffold and `src/shared` + `src/features` trees under `templates/architectures/`, per-framework availability, `--arch`/`--architecture` flags.
- **Scaffolder: back navigation in prompt flow** (#11) — step-based `runPromptFlow` with history stack, preselected values, deferred config-cache write until final confirm.
- **Engine integration proof + M2 docs** (#10, #48) — epic acceptance tests (`tests/unit/composition-epic.test.mjs`) and `docs/engine-capabilities.md`.

### Changed

- **Templates: drop Bootstrap, Tailwind v4-first** (#51) — `allowedStyling` and `STYLING_ENGINES` reduced to `tailwind` + `none`; `templates/css/bootstrap/` deleted; schema rejects `"bootstrap"`.

### Fixed

- **Install crash on peer-heavy devDeps batches** (#57) — `installAllDeps` installs `devDepBatches` per category (testing vs lint/format); `verify:installed` 4/4 green.
- **Verify: ship `none` arch types + arch-aware audit** — flat `none` scaffold gains `src/types/`; offline audit resolves `typesRel` per architecture; `verify:offline` 11/11 green.

## [2.0.0-alpha.1] — 2026-10-01

### Added

- **Manifest v2.1: harness command matrix & architecture validation modes** — `architecture` gains canonical `preset` + legacy `type` alias (must-match) and `validation: strict|relaxed|none` (default `strict`); `harness: { commands: [{ name, command, required?, description? }] }` optional with per-tooling defaults via `defaultHarnessCommands()` (`src/manifest/schema.js`, `src/manifest/emit.js`).
- **Agent Skills: `skills/create-lumen/`** — `SKILL.md` guidance for agents (read `lumen.config.json`, resolve via `manifest.paths`, barrels, `@/*` alias, `harness.commands`, validation modes). Shipped in npm `files`.
- **Scaffolder: `.lumen/` agent context directory** — `src/agent-context.js` `buildAgentContext`/`emitAgentContext` writes byte-deterministic `.lumen/project.json`, `.lumen/architecture.json`, `.lumen/conventions.md` when `agentDocs: true` (wired in `src/main.js`).
- **Contract tests: harness + validation fixtures & drift gate** — 3 valid + 4 invalid fixtures under `schema/fixtures/v2/`, expectations in `tests/unit/manifest.test.mjs`; repaired duplicated Harness section in `docs/contracts/manifest-v2-contract.md` and aligned `docs/manifest-v2.md`.

## [2.0.0-alpha.0] — 2026-09-19

### Added

- **Manifest v2 contract tests & schema fixtures** (#28) — complete fixture suite under `schema/fixtures/v2/` covering 10 valid permutations (React+Vite, Next.js App Router, Next.js Pages Router across feature-based, component-based, hybrid, and none architectures) and 10 invalid permutations (architecture scoping violations, cross-field constraint mismatches, malformed paths, and legacy v1 configs). Comprehensive test suite `tests/unit/manifest.test.mjs` pins schema compliance and exports `schema/fixtures/index.js` for shared consumption by `lumen-cli`.
- **Shared contract between create-lumen and lumen-cli** (#9) — published `docs/contracts/manifest-v2-contract.md` defining the formal specification for manifest v2 structure, the 6-directory path mapping contract, template conventions, and version negotiation.
- **Migration guide v1.x → v2.0.0** (#17) — published `docs/migration/v1-to-v2.md` documenting field-by-field translation from legacy flat configs to nested v2 manifests, fail-fast migration errors, and fast-track instructions for default projects.
- **React + Vite bundle validation under manifest v2** (#23) — verified existing React/Vite templates emit compliant `lumen.config.json` v2 files; wired manifest emission and assertions into offline smoke tests (`tests/smoke/generate.test.mjs`) and verification suites (`tests/verify/verify-offline.mjs`).
- **Non-interactive CLI flags** (#29) — added `--yes` / `-y` (defaults), `--manifest` / `-m` (scaffold from file or inline JSON), `--template` / `-t` (preset shortcuts), `--help` / `-h`, and `--version` / `-v` with robust positional argument filtering in `bin/cli.js` and `src/main.js`.
- **Templates: migrate to Tailwind CSS v4 (v3 dropped)** (#6) — single `@import "tailwindcss";` template in `templates/css/tailwind/src/globals.css`, CSS-first `@theme` tokens in `themes.css`, `@tailwindcss/vite` plugin for React + Vite, and `@tailwindcss/postcss` with `postcss.config.mjs` for Next.js.
- **Tooling: eslint / prettier / oxlint / oxfmt parity in v2 templates** (#24) — full linter × formatter matrix (`eslint`/`oxlint` × `prettier`/`oxfmt`), prompt option to select Oxfmt with ESLint, Next.js seam with `eslint-config-next` and `eslint.config.mjs`, automatic conditional `eslint-config-prettier` wiring, consistent package scripts (`lint`, `lint:fix`, `format`, `format:check`), and format idempotence across multiple passes.
- **React + Vite: validate bundle under manifest v2** (#23) — wired `emitManifest` in verification harnesses and smoke tests, verified byte-deterministic emission and Zod schema compliance of `lumen.config.json` v2 across all matrix cells.
- **CI: publish create-lumen v2 pre-releases to npm** (#31) — configured `.github/workflows/publish.yml` to publish pre-releases (`alpha`, `beta`, `rc`, `next`) to npm under dist-tags and create GitHub pre-releases.
- **Manifest/template contract documentation** (#9) — formalized and documented the shared manifest v2 and path mapping contract in `docs/contracts/manifest-v2-contract.md` consumed by `lumen-cli`.
- **Architecture naming aligned to `type-based`** — renamed the traditional React layout from `component-based` to `type-based` across manifest v2 schema (`ARCHITECTURE_TYPES`), paths resolution (`resolvePaths`), JSON Schema, contract, and documentation. Next.js is explicitly scoped to `hybrid` (and `feature-based` / `none`) instead of `type-based`.

### Removed

- **Tailwind CSS v3 support dropped** (#6) — dropped `tailwind.config.js` and `tailwind.config.ts` in favor of CSS-first `@theme` syntax.

### Breaking Changes

- **Strict v1 manifest rejection** (#14, #17) — `create-lumen` and `lumen-cli` strictly reject v1 flat configurations or manifests missing `manifestVersion: 2`, exiting with instructions pointing to `docs/migration/v1-to-v2.md`.

## [1.2.0] — 2026-09-17

> Promoted to stable from `v1.2.0-beta.1` (2026-09-07) after passing the full
> release bar: `npm test`, `npm run verify` (stratified), `npm run verify:matrix`
> (full offline matrix), and `npm run verify:installed` (real install + build) all
> green.

### Added

- **CSS framework naming: `main.css` for vanilla, `globals.css` for tailwind/bootstrap + `themes.css` everywhere** (`6f6e46c`) — vanilla stylesheet renamed `index.css` → `main.css`; the other two frameworks keep `globals.css`. All three frameworks ship `themes.css` next to the main stylesheet, with the idiomatic shape of their ecosystem (`:root` CSS variables for vanilla, `@custom-variant dark` + `@theme` for Tailwind v4, `:root[data-bs-theme]` for Bootstrap 5.3+). `src/css.js` writes only into the architecture-specific `styles/` folder; `syncMainCssImport` rewrites the import in `main.{ts,jsx}` to match the framework's filename.
- **`providers/` consolidation (feat split, comp co-located)** (`a952a74`) — feat ships `app/{contexts,themecontext.ts}` + `app/providers/ThemeProvider.tsx` + `app/hooks/useTheme.ts`; comp ships `providers/appcontext.ts` + `providers/AppProvider.tsx` + `hooks/useApp.ts`. Fast Refresh `react-refresh/only-export-components` compliant: contexts and hooks live in separate files from the Provider component. Both providers set `document.documentElement.dataset.theme` on every theme change.
- **Router as a folder with split providers (feat per-area, comp centralized)** (`c7e729a`) — feat ships `app/router/{index,guards,routes}/` with `AuthGuard` + `RoleGuard` and per-area route modules; comp ships `router/{index,guards}/` with `AuthGuard` + `GuestGuard` and a single `index.tsx` as the route source of truth.
- **Drop feat `shared/{api,lib}` placeholders** (`836f877`) — under the api-vs-lib exclusivity rule, generated projects never ship folders the selection doesn't own.
- **Catch-up README + readme.js + leftover folder deletes** (`4975780`) — bundled working-tree changes from commits 1-4 (README trees, error-resolution-matrix react-refresh row, `src/readme.js` selection-aware `styles/` row, `.gitkeep` placeholders for `styles/` + `config/` folders, stale file deletes).
- **Framework-aware component styling** (`08f70e4`) — App shell, Button, layout, and the icon overlays (`lucide`, `huge`) all switch markup with the CSS choice instead of hardcoding Tailwind. Variants live in `templates/css/component-styles/{tailwind,bootstrap}/`.
- **Data-router + `Outlet` parity** (`08f70e4`) — component-based `routes/` migrates to `createBrowserRouter`/`RouterProvider` with `MainLayout` as parent; feature-based gains `shared/layouts/RootLayout` so the app chrome is preserved.
- **Strict folder pruning** (`08f70e4`) — a generic post-injection pass removes `.gitkeep` placeholders from directories an overlay populated with real files.
- **Redux overlay co-location** (`a952a74`) — `StoreProvider` moves from `src/context/StoreProvider` → `src/providers/StoreProvider` to match the providers consolidation rule.
- **CSS globals fix (v1.2.0 regression)** (`08f70e4`) — `src/css.js` now writes the chosen framework's stylesheet to the globals file each architecture actually imports (`shared/styles/globals.css` for feature-based, `styles/globals.css` for component-based).
- **Component-based types parity** (`09da701`) — generated `tsconfig.app.json` is `strict: true`; `useLocalStorage<T>`, zustand `create<CounterState>`, redux `PayloadAction`/`RootState`/`AppDispatch` typed end-to-end.
- **Generated `typecheck` script** (`09da701`) — `tsc -b` independent of `build` (which stays `vite build`).
- **Axios as `api`** (`8ec162c`, `be5a709`, `90fc13e`) — refactored from monolithic `axios.ts` into a split layer (`api.config` + `api.client`) and exported end-to-end as `api` (default export + barrel re-export), not `apiClient`. `user.service` performs real CRUD (`get`/`post`/`put`/`delete`).
- **Fetch layer parity** (`d229f8f`) — fetch client mirrors the axios layout (`api.config` + `api.client`) with `get`/`post`/`put`/`delete`, configured to intercept `VITE_API_URL`.
- **Feature-based `shared/` grouping** (`6e6eda2`) — reusable resources moved under `src/shared/` (`api`, `components`, `hooks`, `layouts`, `lib`, `stores`, `styles`, `types`, `utils`).
- **api-vs-lib rule** (`6e6eda2`, `c36b616`) — fetch client lives in `src/shared/api/`; axios client lives in `src/shared/lib/axios/`. Folders are strictly mutually exclusive.
- **Removed unused barrels** (`6e6eda2`) — non-consumed barrel files deleted; `.gitkeep` placeholders preserve folders that would otherwise disappear.
- **Public feature barrel** (`6e6eda2`) — `features/home/index.ts` re-exports the feature's public surface.

### Changed

- **App wiring** (`a952a74`) — App wraps `<AppProvider>` (comp) or `<ThemeProvider>` (feat); router overlays wrap App with their respective provider.
- **Components consume CSS variables** (`a952a74`) — Button, Home/HomePage, MainLayout, RootLayout, App shells, router placeholders, auth.routes protected page all use `var(--color-*)` instead of hex codes for the `none` framework, so `data-theme` switches actually repaint.
- **Redux overlay import path** (`a952a74`) — Injector's `updateMainWithProvider` now imports `./providers/StoreProvider` instead of `./context/StoreProvider`.

### Removed

- **Vite's stale `src/index.css`** (`6f6e46c`, `4975780`) — `src/css.js` writes only into the architecture-specific `styles/` folder; `injectArchitecture` removes the leftover before copy, and `deleteIfExists` cleans it up after.
- **Comp `src/context/{app-context,AppContext}.{ts,tsx,js,jsx}`** (`836f877`) — six orphan files no cell consumed.
- **Comp `src/config/routes.{ts,js}`** (`836f877`) — dead `ROUTES` constants; nothing imported them.
- **Comp `src/components/layout/`** (`08f70e4`) — duplicate of `src/layouts/`.
- **Old `src/app/router.{ts,tsx}` (feat) + `src/routes/index.{ts,tsx}` (comp)** (`c7e729a`, `4975780`) — replaced by the folder structure.
- **Per-feature `interfaces/` folder** (`6e6eda2`) — types live in `shared/types` (global).
- **`src/config/constants.{ts,js}`** (`90fc13e`) — both API clients inline `VITE_API_URL` directly.

## [1.1.4] — 2026-08-28

### Fixed

- Verified generated scaffolds against a pinned lint/format/test toolchain (`97ef771`).

## [1.1.3] — 2026-08-27

### Fixed

- Update project name resolution to ignore flag arguments (`5b8d81f`).
- Respect quick setup and dynamic banner version (`0981fff`).

## [1.1.2] — 2026-08-27

### Fixed

- Handle `-y` project name fallback (`18896d8`).
- Update non-interactive quick setup command syntax in README (`77c56d1`).
- Make generated TS scaffolds strict-clean (`b1c865a`).

## [1.1.1] — 2026-08-27

### Fixed

- Include `register.js` in npm publish files (`2240ee1`).

## [1.1.0] — 2026-08-27

### Added

- **Dynamic formatter selection** — ESLint → None | Prettier; Oxlint → None | Oxfmt | Prettier.
- **Prettier & Oxfmt config scaffolding** — `templates/conditional/formatter/{prettier,oxfmt}/`.
- **`format` / `format:check` scripts** — appended by `injectFormatter()` to `package.json`.
- **`.env.example` scaffolding** — copied via `copyEnvExample()`; `.gitignore` updated to ignore env files while whitelisting `.env.example`.
- **Non-interactive `-y` flag** — Quick Setup defaults skip the prompt flow.
- **Path aliases (`@/*` → `src/*`)** — generated `tsconfig`/`jsconfig` + Vite config; scaffolder itself gets a root `jsconfig.json`.
- **README project description generation** — `src/readme.js` produces a real description reflecting the architecture and chosen tooling, plus "Built With" and scripts.

## [1.0.0] — 2026-08-26

### Added

- Architecture choice: **feature-based** or **component-based**.
- Language choice: **TypeScript** or **JavaScript**.
- CSS frameworks: **Tailwind**, **Bootstrap**, or **none**.
- Optional state management: **Zustand** or **Redux Toolkit**.
- Optional **React Router**.
- Optional testing: **Vitest** or **Jest**.
- Linting: **ESLint** (default) or **Oxlint**.
- Optional **Axios** data-fetching and icon libraries (**lucide**, **huge**).
- Auto `git init`, generated `README.md` and `LICENSE`.
- **`@/` path alias** configured (`tsconfig`/`jsconfig` + Vite).
- **Choice caching** — selections cached in `~/.lumen-config.json` and offered as defaults on re-runs.
- **Templates**:
  - `templates/architectures/{feature-based,component-based}` (base trees).
  - `templates/conditional/{state,router,icons,axios,fetch,testing,linting}` (overlays).
- **Orchestrator** — `bin/cli.js` → `src/main.js` runs `npm create vite` → base install → inject architecture → conditional overlays → conditional deps → CSS setup → configure aliases/scripts → cleanup → README.
