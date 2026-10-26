# ADR 0003: Agent-First Ecosystem and Harness Contract

## Status

Accepted

## Context

The Lumen ecosystem consists of `create-lumen` (the project scaffolder) and `lumen-cli` (the developer CLI for ongoing project evolution). Both tools must serve two audiences: human developers and AI agents. The contract between them (the manifest) must be rich enough to enable agents to understand and operate on a project without guesswork.

Initially, the manifest v2 captured the static choices made during project creation (framework, styling, architecture, etc.). However, to support agent-driven workflows, we need to extend the manifest to include:

1. A configurable harness: the set of commands that `lumen-cli` runs to validate the project (lint, format, type-check, test, build). This harness must be definable per project and extensible by the user.
2. An architecture validation mode: to allow `lumen doctor` to operate in different modes (`strict`, `relaxed`, `none`) depending on whether the user wants to enforce known architectural invariants, allow extensions, or disable architectural validation entirely.
3. An optional agent context directory (`.lumen/`) that provides precomputed, agent-friendly representations of the project's manifest, architecture, and conventions.

## Decision

We extend the manifest v2 schema with two new top-level fields:

- `harness`: an object containing an array of command objects. Each command has:
  - `name`: a string identifier (e.g., `"lint"`).
  - `command`: the shell command to execute (e.g., `"oxlint ."`).
  - `required`: a boolean indicating whether the command must succeed for the harness to pass (default: `true`).
  - `description`: an optional string describing the command's purpose.

- `architecture`: an object that now includes:
  - `preset`: the architecture type (`"feature-based"`, `"type-based"`, `"hybrid"`, `"none"`).
  - `validation`: the validation mode for `lumen doctor` (`"strict"`, `"relaxed"`, `"none"`).

Additionally, when the manifest includes `agentDocs: true` (or when the user opts in via a flag), `create-lumen` will generate a `.lumen/` directory in the project root with the following files:
- `project.json`: a copy of the resolved manifest.
- `architecture.json`: an object with the keys `preset` and `validation`.
- `conventions.md`: a markdown file documenting project-specific conventions (to be defined by the project or left as a placeholder).

## Consequences

### Positive

- Agents can now inspect the manifest to understand the project's validation harness and run it to check the project's health.
- Agents can invoke `lumen doctor` with confidence knowing the validation mode (`strict`/`relaxed`/`none`) and adjust their expectations accordingly.
- The harness is fully configurable, allowing projects to define custom validation steps beyond the standard lint/format/types/test/build.
- The optional `.lumen/` directory provides a fast, low-bandwidth way for agents to get the essential project metadata without parsing the entire source tree.

### Negative

- The manifest becomes slightly more complex, but the changes are backward compatible with v2.0.0-alpha (the new fields are optional and have sensible defaults).
- Users must opt-in to generate the `.lumen/` directory (via `agentDocs: true` or a CLI flag) to avoid unnecessary files in projects that do not use agents.

## Implementation Plan

1. Update the Zod schema in `src/manifest/schema.js` to include the new `harness` and updated `architecture` fields.
2. Update the JSON Schema target (`schema/lumen.config.v2.json`) via the generation script.
3. Update the manifest emitter (`src/manifest/emit.js`) to include the new fields with appropriate defaults.
4. Update `create-lumen` to conditionally generate the `.lumen/` directory when `agentDocs` is true.
5. Update `lumen-cli` to:
   - Read the `harness` configuration and implement `lumen harness` to run the commands in order.
   - Read the `architecture.validation` to control the behavior of `lumen doctor`.
   - Optionally, read the `.lumen/` directory for faster metadata access (fallback to manifest if not present).
6. Update the documentation:
   - `docs/contracts/manifest-v2-contract.md`: formalize the new contract.
   - `docs/manifest-v2.md`: update the Shape and v1->v2 diff sections.
   - `README.md`: update the Manifest v2 & Ecosystem Architecture section.
   - Create this ADR.

## Related Issues

- `create-lumen` issue: [Manifest v2.1: Add harness command matrix & architecture validation modes to schema]
- `create-lumen` issue: [Agent Skills: Create `skills/create-lumen` package guidance]
- `create-lumen` issue: [Scaffolder: Emit `.lumen/` agent context directory on creation]
- `create-lumen` issue #67: [refactor(agent-docs): replace .lumen/ directory with root AGENTS.md referencing lumen.config.json (SSOT)]

## Addendum (Issue #67: Single Source of Truth via AGENTS.md)

To avoid duplicating JSON metadata between `lumen.config.json` and `.lumen/{project,architecture}.json`, the `.lumen/` directory was replaced with a clean, root-level `AGENTS.md`. `AGENTS.md` treats `lumen.config.json` as the Single Source of Truth (SSOT), providing AI agents with architecture rules, component taxonomy mappings (`paths.ui`, `paths.components`, and feature components), harness commands, and Next.js guidelines (RSC vs `"use client"`) without emitting duplicate metadata files.
- `create-lumen` issue: [Contract Tests: Fixtures & drift gate for harness and validation schema]

