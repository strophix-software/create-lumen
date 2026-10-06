# Migration Guide: create-lumen v1.x → v2.0.0

> **Target Audience**: Developers with projects scaffolded using `create-lumen` 1.x migrating to v2, or adopting `lumen.config.json` in existing workspaces.  
> **Applicable Versions**: `create-lumen` >= 2.0.0, `lumen-cli` >= 1.0.0  
> **Related Issues**: `#17`, `#13`, `#14`, `#15`, `#16`, `#9`, `#28`

---

## 1. Why v2?

`create-lumen` 1.x used a flat configuration format focused exclusively on Vite + React. It lacked support for:
- Multi-framework capabilities (Next.js App Router and Pages Router).
- Framework-specific options (Turbopack, adapters, server/client boundaries).
- Dynamic and explicit generator path mappings consumed by `lumen-cli`.
- Tooling parity across linters (`eslint`, `oxlint`, `biome`) and formatters (`prettier`, `oxfmt`).

v2 introduces a strict, nested manifest (`manifestVersion: 2`) validated by Zod and JSON Schema.

---

## 2. Fast-Track: "I Used the CLI Defaults"

If your project was generated using standard options (React + Vite + TypeScript + Tailwind + feature-based architecture), you can migrate in 30 seconds:

1. Add `<projectRoot>/lumen.config.json` to your project root (v1 did not have a config file; `lumen.config.json` is a new improvement for v2):
   ```json
   {
     "$schema": "https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json",
     "manifestVersion": 2,
     "framework": {
       "name": "react",
       "variant": "vite"
     },
     "styling": {
       "engine": "tailwind"
     },
     "architecture": {
       "type": "feature-based"
     },
     "ui": {
       "kit": "none"
     },
     "docs": {
       "language": "en"
     },
     "paths": {
       "features": "src/features",
       "components": "src/shared/components",
       "services": "src/shared/services",
       "hooks": "src/shared/hooks",
       "pages": "src/app/router",
       "ui": "src/shared/components/ui"
     },
     "tooling": {
       "language": "ts",
       "linter": "eslint",
       "formatter": "prettier"
     }
   }
   ```
2. Run `npx create-lumen --version` or `lumen doctor` to verify configuration integrity.

> [!TIP]
> Alternatively, if you want a completely fresh scaffold, you can run:
> ```bash
> npx create-lumen@alpha my-new-app
> ```
> and copy over your custom feature code into `src/features/`.

---

## 3. What Happens with a v1 Config?

Projects generated in v1 did not have a configuration file; `lumen.config.json` is a new improvement in v2. Both `create-lumen` (when reading a manifest via `--manifest` / `-m`) and `lumen-cli` strictly reject legacy flat configuration structures (missing `manifestVersion: 2` or using top-level flat keys) with exit code `1`:

```
Manifest v1 detected (flat config). create-lumen v2 uses a nested manifest (manifestVersion: 2).
Please migrate: delete the old config and re-run create-lumen, or see the migration guide (docs/migration/v1-to-v2.md).
Raw keys: framework, css, architecture, language, router, stateManagement...
```

This fail-fast behavior protects your codebase from accidental file generation in invalid directories.

### How to Fix
1. Add `<projectRoot>/lumen.config.json` using the new v2 nested format following the [Field-by-Field Mapping](#4-field-by-field-mapping-reference) below.
2. If you have an existing flat configuration object, convert it to the nested v2 shape.
3. Validate your manifest against the JSON schema (`https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json`).

---

## 4. Field-by-Field Mapping Reference

Every key from v1 has a designated equivalent, is scoped into a nested namespace, or has been intentionally removed from the top-level manifest.

| v1 Field (Flat) | v1 Type / Values | v2 Location & Shape | Description & Migration Notes |
| :--- | :--- | :--- | :--- |
| *(none)* | *(absent)* | `"manifestVersion": 2` | **Required integer.** Explicit schema version gate. Must be `2`. |
| *(none)* | *(absent)* | `"$schema": "https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json"` | **Optional / Defaulted.** Provides IDE autocompletion and hover documentation. |
| `framework` | `"react"` | `"framework": { "name": "react", "variant": "vite" }` | Framework is now an object. In v2, `react` requires `variant: "vite"`. Next.js targets use `name: "next"` with `variant: "app-router"` or `"pages-router"`. |
| *(none)* | *(absent)* | `"framework.bundler": "turbopack" \| "webpack"` | Optional Next.js bundler selector. Invalid on React+Vite. |
| *(none)* | *(absent)* | `"framework.adapter": "node" \| "vercel" \| "cloudflare" \| "static"` | Optional Next.js deployment adapter. Invalid on React+Vite. |
| `css` / `cssFramework` | `"tailwind"`, `"bootstrap"`, `"none"` | `"styling": { "engine": "tailwind" \| "none" }` | Renamed and nested under `styling`. **Important:** Bootstrap is dropped in v2 in favor of Tailwind CSS v4 and vanilla CSS. Tailwind in v2 is strictly **Tailwind CSS v4** (Tailwind v3 is dropped). |
| `architecture` | `"feature-based"`, `"component-based"` | `"architecture": { "type": "feature-based" \| "type-based" \| "hybrid" \| "none" }` | Scoped per framework: React allows `feature-based`, `type-based`, and `none`. Next.js allows `feature-based`, `hybrid`, and `none` (Next.js supports `hybrid` instead of `type-based`). |
| *(none)* | *(absent)* | `"ui": { "kit": "shadcn" \| "none" }` | UI kit selection. **Constraint:** `shadcn` requires `styling.engine: "tailwind"`. |
| *(none)* | *(absent)* | `"docs": { "language": "en" \| "es" }` | Project documentation language choice for generated readmes and CLI generators. |
| *(none)* | *(hardcoded)* | `"paths": { "features", "components", "services", "hooks", "pages", "ui" }` | **Required object.** Explicit relative paths from project root, resolved deterministically per framework and architecture. See [Path Resolution](#5-path-resolution-reference). |
| `language` | `"ts"`, `"js"` | `"tooling": { "language": "ts" \| "js", ... }` | Moved into the `tooling` object. |
| `linter` | `"eslint"`, `"oxlint"`, `"none"` | `"tooling": { "linter": "eslint" \| "oxlint" \| "biome" \| "none", ... }` | Moved into `tooling`. Added support for `biome`. |
| *(none)* | *(absent)* | `"tooling": { "formatter": "prettier" \| "oxfmt" \| "none" }` | Formatter selection moved into `tooling`. |
| `router` | `"react-router"`, `"none"` | **Removed from manifest** | In React+Vite, router selection is handled at scaffold time via templates/overlays. In Next.js, routing is intrinsic to the framework variant. |
| `stateManagement` | `"zustand"`, `"redux"`, `"none"` | **Removed from manifest** | State management dependencies are scaffolded into `package.json` and store directories; not required in generator manifest. |
| `iconLibrary` | `"lucide"`, `"hugeicons"`, `"none"` | **Removed from manifest** | Overlay dependency handled during project initialization. |
| `apiClient` | `"axios"`, `"fetch"`, `"none"` | **Removed from manifest** | Handled in `src/shared/lib/axios` vs `src/shared/api` by scaffolder templates; path mapping in v2 points to `services`. |
| `testing` | `"vitest"`, `"jest"`, `"none"` | **Removed from manifest** | Test runner scripts and dependencies live directly in `package.json`. |
| *(none)* | *(absent)* | `"reactCompiler": true \| false` | Optional cross-cutting compiler flag (Next.js & future React 19 toolchains). |
| *(none)* | *(absent)* | `"agentDocs": true \| false` | Optional flag indicating inclusion of LLM assistant guidelines (`AGENTS.md`). |

---

## 5. Path Resolution Reference

In v1, paths were hardcoded in generator routines. In v2, `paths` explicitly instructs `lumen-cli` where code belongs:

### 1. React + Vite (Feature-Based):
```json
"paths": {
  "features": "src/features",
  "components": "src/shared/components",
  "services": "src/shared/services",
  "hooks": "src/shared/hooks",
  "pages": "src/app/router",
  "ui": "src/shared/components/ui"
}
```

### 2. React + Vite (Type-Based):
```json
"paths": {
  "features": "src/features",
  "components": "src/components",
  "services": "src/services",
  "hooks": "src/hooks",
  "pages": "src/pages",
  "ui": "src/ui"
}
```

### 3. Next.js (App Router, Feature-Based or Hybrid):
```json
"paths": {
  "features": "src/features",
  "components": "src/shared/components",
  "services": "src/shared/services",
  "hooks": "src/shared/hooks",
  "pages": "app",
  "ui": "src/shared/components/ui"
}
```

---

## 6. Example Before & After

### v1 Concept (Legacy Flat Options)

> [!NOTE]
> In v1, there was no project configuration file — `lumen.config.json` is a new improvement for v2. The flat options below represent the prompt choices and parameters used in v1:

```json
{
  "framework": "react",
  "css": "tailwind",
  "architecture": "feature-based",
  "language": "ts",
  "router": true,
  "stateManagement": "none",
  "iconLibrary": "none",
  "apiClient": "none",
  "testing": "vitest",
  "linter": "eslint",
  "formatter": "prettier"
}
```

### v2 (New `lumen.config.json` Improvement)

`lumen.config.json` is the new project manifest introduced in v2 (`manifestVersion: 2`), enabling companion developer tools like `lumen-cli` to understand your project architecture and path mappings:

```json
{
  "$schema": "https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json",
  "manifestVersion": 2,
  "framework": {
    "name": "react",
    "variant": "vite"
  },
  "styling": {
    "engine": "tailwind"
  },
  "architecture": {
    "type": "feature-based"
  },
  "ui": {
    "kit": "none"
  },
  "docs": {
    "language": "en"
  },
  "paths": {
    "features": "src/features",
    "components": "src/shared/components",
    "services": "src/shared/services",
    "hooks": "src/shared/hooks",
    "pages": "src/app/router",
    "ui": "src/shared/components/ui"
  },
  "tooling": {
    "language": "ts",
    "linter": "eslint",
    "formatter": "prettier"
  }
}
```

---

## 7. Tailwind CSS v4 Notes

If you migrate a project using Tailwind CSS:
- `create-lumen` 2.0 dropped support for Tailwind v3.
- In v2, Tailwind configuration is CSS-first:
  - Global stylesheet: `src/shared/styles/globals.css` (or `src/styles/globals.css`) uses `@import "tailwindcss";`.
  - Color tokens and dark mode styling live in `themes.css` using `@theme` and `@custom-variant dark`.
  - There is no longer a `tailwind.config.js` or `tailwind.config.ts`.
  - The Vite build plugin is `@tailwindcss/vite`.

---

## 8. History & Ecosystem Timeline

`lumen.config.json` is a new improvement introduced in v2 alongside `lumen-cli` 1.x to establish a shared contract between the scaffolder and companion developer tools. Projects created with `create-lumen` 1.x did not have any project configuration file; adopting v2 brings structured configuration, explicit path mappings, and multi-framework support.

---

## 9. Next.js Support in v2.0.0 (Milestone 3)

Starting with `create-lumen` 2.0.0, the scaffolder expands beyond React + Vite to provide first-class support for Next.js 16 and React 19.

### Key Conceptual Differences from v1 (React + Vite)

1. **Dual Routing Paradigms:**
   - **App Router (`app-router`):** React Server Components (RSC) by default, streaming Suspense, nested `layout.tsx`, and standard Web API Route Handlers (`route.ts`).
   - **Pages Router (`pages-router`):** Classic page-based routing in `src/pages/`, `getServerSideProps` / `getStaticProps`, and Node.js API Routes (`pages/api/*.ts`).

2. **Intrinsic Routing vs. React Router:**
   In v1, routing was an optional client library (`react-router`). In Next.js, filesystem routing is built-in (`supportsRouterPrompt: false`). The `paths.pages` property points to either `"src/app"` (App Router) or `"src/pages"` (Pages Router).

3. **Bundler & Deployment Adapters:**
   v2 introduces two new Next.js-specific manifest options under `framework`:
   - `framework.bundler`: `"turbopack"` (default, high-performance Rust bundler) or `"webpack"`.
   - `framework.adapter`: `"node"` (standalone Docker-ready server), `"vercel"` (native cloud serverless/edge), `"cloudflare"` (edge workers), or `"static"` (static HTML export in `out/`).

4. **Component Boundaries:**
   Projects targeting the App Router run components on the server by default. Interactive stateful components require the `"use client"` directive.

### Next.js Manifest Example (`lumen.config.json`)

```json
{
  "$schema": "https://lumen-sh.github.io/create-lumen/schema/lumen.config.v2.json",
  "manifestVersion": 2,
  "framework": {
    "name": "next",
    "variant": "app-router",
    "bundler": "turbopack",
    "adapter": "node"
  },
  "styling": {
    "engine": "tailwind"
  },
  "architecture": {
    "type": "feature-based"
  },
  "ui": {
    "kit": "shadcn"
  },
  "docs": {
    "language": "en"
  },
  "paths": {
    "features": "src/features",
    "components": "src/shared/components",
    "services": "src/shared/services",
    "hooks": "src/shared/hooks",
    "pages": "src/app",
    "ui": "src/shared/components/ui"
  },
  "tooling": {
    "language": "ts",
    "linter": "eslint",
    "formatter": "prettier"
  },
  "reactCompiler": true,
  "agentDocs": true
}
```

---

## References

- [Manifest v2 Overview](../manifest-v2.md)
- [Manifest & Template Shared Contract](../contracts/manifest-v2-contract.md)
- [JSON Schema Specification](../../schema/lumen.config.v2.json)
- [ADR 0001: Scaffolder Base Strategy](../adr/0001-scaffolder-base-strategy.md)
- [Next.js App Router Guide](../next-app-router.md)
- [Next.js Pages Router Guide](../next-pages-router.md)
- [Next.js Deployment Adapters Guide](../next-adapters.md)
