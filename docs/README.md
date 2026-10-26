# create-lumen Documentation

Welcome to the `create-lumen` documentation. This directory contains architectural specifications, ecosystem contracts, migration guides, and roadmap tracking for the Lumen project scaffolder.

---

## 📚 Core Architecture & Specifications

- **[Generator Engine & Capabilities Guide (M2)](./engine-capabilities.md):** Complete guide to the capability declaration model, `BaseProvider` seam, template fragment composition, shadcn/ui integration with Tailwind CSS v4, `none` and `hybrid` architectures, and the migration from Bootstrap to Tailwind CSS v4.
- **[Next.js App Router Guide (M3)](./next-app-router.md):** App Router scaffold, filesystem routing, route handlers, server/client boundaries, `next/font` and `next/image`.
- **[Next.js Pages Router Guide (M3)](./next-pages-router.md):** Pages Router scaffold, API routes, `_app`/`_document` wiring, and parity with the App Router contract.
- **[Next.js Deployment Adapters (M3)](./next-adapters.md):** Adapter matrix (Node, Vercel, Cloudflare, static), bundler (Turbopack/Webpack) and Biome configuration for Next.js projects.
- **[Manifest v2 Specification](./manifest-v2.md):** Specification of the nested schema (`lumen.config.json` v2), validation behavior, path mappings, and agent integration.
- **[Manifest & Template Contract](./contracts/manifest-v2-contract.md):** Formal versioned contract between `create-lumen` and `lumen-cli`.
- **[Manifest-Template Contract](./manifest-template-contract.md):** Specification connecting generator outputs and template layouts.

---

## 🏛 Architecture Decision Records (ADRs)

- **[ADR 0001: Scaffolder Base Strategy](./adr/0001-scaffolder-base-strategy.md):** Vendored base templates, dev-time only external CLIs, and deterministic generation.
- **[ADR 0002: Branching Strategy](./adr/0002-branching-strategy.md):** Dual mainline branching model (`main` for v1.x stable, `develop` for v2 pre-releases).
- **[ADR 0003: Agent-First Ecosystem and Harness Contract](./adr/0003-agent-first-ecosystem-and-harness-contract.md):** Harness command matrix, architecture validation, and `.lumen/` agent context.

---

## 🔄 Migration & Developer Guides

- **[v1 to v2 Migration Guide](./migration/v1-to-v2.md):** Step-by-step instructions for upgrading projects and configs from v1.x to v2.0.0.
- **[Branching & Contribution Guide](./BRANCHING.md):** Workflow conventions, release lines, and PR verification checklist.
- **[Testing Strategy & Harnesses](./tests/README.md):** Test suites, offline verification matrices, and smoke testing.

---

## 🗺 Roadmap & Planning

- **[Roadmap (Milestones M1–M5)](./ROADMAP.md):** Functional milestone progression, issue dependency matrices, and multi-framework vision.
- **[Visual Plan & Dependency Diagrams](./PLAN.md):** Mermaid diagrams of the pipeline, cross-project dependencies, and parallel developer lanes.
- **[Changelog](./CHANGELOG.md):** Historical and unreleased changes structured per Keep a Changelog.
