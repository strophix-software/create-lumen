# Manifest and Template Contract: create-lumen ↔ lumen-cli

> **Contract Version**: 2.0  
> **Participating Packages**: `create-lumen` (scaffolder/producer), `lumen-cli` (developer CLI/consumer)  
> **Tracking Issues**: `create-lumen#9`, `create-lumen#28`, `lumen-cli#3`, `lumen-cli#7`  
> **Schema URI**: `https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json`

---

## 1. Overview

`create-lumen` initializes a new repository and writes a canonical `lumen.config.json` at project root. `lumen-cli` executes daily-dev subcommands (`lumen g feature`, `lumen g component`, `lumen g service`, `lumen g page`, `lumen doctor`, etc.) inside that repository.

To ensure seamless interoperability without hardcoded magic paths, both tools conform to this versioned contract.

---

## 2. Manifest Surface

The manifest is emitted at `<projectRoot>/lumen.config.json` as a UTF-8 JSON file formatted with a 2-space indentation and a terminating newline.

### Strict Top-Level Structure

```json
{
  "$schema": "https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json",
  "manifestVersion": 2,
  "framework": {
    "name": "react | next",
    "variant": "vite | app-router | pages-router",
    "bundler": "turbopack | webpack (Next.js only, optional)",
    "adapter": "node | vercel | cloudflare | static (Next.js only, optional)"
  },
  "styling": {
    "engine": "tailwind | none"
  },
  "architecture": {
    "type": "feature-based | type-based | none"
  },
  "ui": {
    "kit": "shadcn | none"
  },
  "docs": {
    "language": "en | es"
  },
  "paths": {
    "features": "string (min length 1, posix)",
    "components": "string (min length 1, posix)",
    "services": "string (min length 1, posix)",
    "hooks": "string (min length 1, posix)",
    "pages": "string (min length 1, posix)",
    "ui": "string (min length 1, posix)"
  },
  "tooling": {
    "language": "ts | js",
    "linter": "eslint | oxlint | biome | none",
    "formatter": "prettier | oxfmt | none"
  },
  "reactCompiler": "boolean (optional)",
  "agentDocs": "boolean (optional)"
}
```

### Deterministic Key Ordering
Emitters MUST preserve canonical key order:
`["$schema", "manifestVersion", "framework", "styling", "architecture", "ui", "docs", "paths", "tooling"]` followed by optional feature flags.

---

## 3. Path Mapping Contract

All paths in `paths` MUST:
1. Be relative to project root.
2. Use POSIX forward-slash (`/`) separators on all operating systems (Windows, Linux, macOS).
3. Be non-empty strings.

### Resolution Matrix

| Framework | Variant | Architecture | `features` | `components` | `services` | `hooks` | `pages` | `ui` |
|-----------|---------|--------------|------------|--------------|------------|---------|---------|------|
| `react` | `vite` | `feature-based` | `src/features` | `src/shared/components` | `src/shared/services` | `src/shared/hooks` | `src/app/router` | `src/shared/components/ui` |
| `react` | `vite` | `type-based` | `src/features` | `src/components` | `src/services` | `src/hooks` | `src/pages` | `src/ui` |
| `react` | `vite` | `none` | `src` | `src/components` | `src/services` | `src/hooks` | `src/pages` | `src/components/ui` |
| `next` | `app-router` | `feature-based` | `src/features` | `src/shared/components` | `src/shared/services` | `src/shared/hooks` | `src/app` | `src/shared/components/ui` |
| `next` | `app-router` | `none` | `src` | `src/components` | `src/services` | `src/hooks` | `src/app` | `src/components/ui` |
| `next` | `pages-router` | `feature-based` | `src/features` | `src/shared/components` | `src/shared/services` | `src/shared/hooks` | `src/pages` | `src/shared/components/ui` |
| `next` | `pages-router` | `none` | `src` | `src/components` | `src/services` | `src/hooks` | `src/pages` | `src/components/ui` |

> [!NOTE]
> `lumen-cli` reads generator targets strictly from `paths` and never hardcodes `src/components` or `src/features`.

---

## 4. Template & Generator Contract

Generators in `lumen-cli` and templates in `create-lumen` adhere to the following rules:

### 4.1. File Extensions and Dialect
- When `tooling.language === "ts"`:
  - React/JSX files use `.tsx`.
  - Non-JSX TypeScript modules use `.ts`.
  - Configuration files use `.ts` where supported (e.g. `vite.config.ts`, `vitest.config.ts`), or `.js` when required by native tooling.
- When `tooling.language === "js"`:
  - React/JSX files use `.jsx`.
  - Non-JSX JavaScript modules use `.js`.

### 4.2. Barrels and Exports
- Every domain feature directory (`<paths.features>/<feature-name>/`) must expose a public entry point `index.ts` (or `index.js`).
- Subdirectories inside a feature (`components/`, `services/`, `hooks/`, `types/`) are internal to the feature unless re-exported by the feature's top-level barrel.
- Intermediate dead barrels (e.g. `src/services/index.ts` when no services exist) must not be generated.

### 4.3. Path Aliasing
- All templates configure `@/*` pointing to `src/*` (in `tsconfig.app.json` or `jsconfig.json`).
- Cross-feature imports should use relative paths or `@/shared/...` aliases.

---

## 5. Version Negotiation & Migration Contract

### Strict v1 Rejection
`lumen-cli` and `create-lumen` must reject legacy v1 configurations (e.g., configurations containing flat keys `css`, `architecture` as string, or `manifestVersion: 1`).

Upon detecting a v1 config, tooling must terminate immediately with an exit code of `1` and emit this exact diagnostic:
```
Manifest v1 detected (flat config). create-lumen v2 uses a nested manifest (manifestVersion: 2).
Please migrate: delete the old config and re-run create-lumen, or see the migration guide (docs/migration/v1-to-v2.md).
```

### Breaking Changes Gate
- Any change that alters the structural shape of `lumen.config.json` or modifies default path resolution requires:
  1. Incrementing `manifestVersion` (e.g. to `3`).
  2. A published ADR in `docs/adr/`.
  3. A corresponding migration path documented in `docs/migration/`.

---

## 6. Shared Fixtures

`create-lumen` publishes test fixtures in its npm package under `schema/fixtures/`:
- `schema/fixtures/v2/valid/`: 10 canonical manifests covering every valid architecture and framework combo.
- `schema/fixtures/v2/invalid/`: 10 manifests asserting validation errors (scoping rules, constraints, v1 rejection).
- `schema/fixtures/index.js`: programmatic helper functions (`loadValidFixtures()`, `loadInvalidFixtures()`, `getFixture()`).

`lumen-cli`'s config reader tests (`lumen-cli#3`) consume these exact fixtures to guarantee 100% parity across repositories.
