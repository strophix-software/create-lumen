import { promises as fsp } from "node:fs";
import path from "node:path";
import { buildManifest } from "./manifest/emit.js";

const VALIDATION_NOTES = {
  strict: "strict: architecture boundaries are enforced — do not import across features except via barrels or shared paths; violations must be fixed.",
  relaxed: "relaxed: architecture boundaries are advisory — prefer barrels and shared paths, but cross-imports only warn.",
  none: "none: no architecture validation — paths are still the canonical locations.",
};

function resolveManifest(manifestOrResponses) {
  if (manifestOrResponses && typeof manifestOrResponses.manifestVersion !== "undefined") {
    return manifestOrResponses;
  }
  if (manifestOrResponses && manifestOrResponses._manifestSource) {
    return manifestOrResponses._manifestSource;
  }
  return buildManifest(manifestOrResponses);
}

/**
 * Render the root AGENTS.md document from a manifest.
 * Single Source of Truth (SSOT): references `lumen.config.json` directly.
 * Byte-deterministic: derived only from stable manifest fields (no timestamps).
 * @param {object} manifest - validated manifest v2
 * @returns {string}
 */
export function renderAgentsMd(manifest) {
  const preset = manifest.architecture?.preset ?? manifest.architecture?.type ?? "feature-based";
  const validation = manifest.architecture?.validation ?? "strict";
  const paths = manifest.paths ?? {};
  const harness = manifest.harness ?? { commands: [] };
  const barrelFile = manifest.tooling?.language === "js" ? "index.js" : "index.ts";
  const isNext = manifest.framework?.name === "next";

  const pathLines = Object.entries(paths)
    .map(([key, value]) => `- ${key}: \`${value}\``)
    .join("\n");

  const harnessLines = (harness.commands ?? [])
    .map((c) => `- \`${c.name}\`: \`${c.command}\` (${c.required === false ? "optional" : "required"})`)
    .join("\n");

  const harnessSummary = (harness.commands ?? []).map((c) => `\`${c.command}\``).join(", ");

  let nextSection = "";
  if (isNext) {
    nextSection =
      `<!-- BEGIN:nextjs-agent-rules -->\n` +
      `## This is NOT the Next.js you know\n` +
      `This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ (resolved from this file's directory...) before writing any code. Heed deprecation notices.\n` +
      `<!-- END:nextjs-agent-rules -->\n` +
      `\n` +
      `### Next.js Component Rules\n` +
      `\n` +
      `- By default, all components in the App Router are React Server Components (RSC).\n` +
      `- Use the \`"use client"\` directive only at the top of files that require browser APIs, React state, or event handlers.\n` +
      `- Never import server-only modules or secrets into client components.\n` +
      `\n`;
  }

  const uiPath = paths.ui ?? "@/components/ui";
  const componentsPath = paths.components ?? "@/components";

  return (
    `# AGENTS.md\n` +
    `\n` +
    `> **Single Source of Truth (SSOT)**: Project configuration, paths, and harness definitions are defined in \`lumen.config.json\`. Consult \`lumen.config.json\` for the authoritative settings.\n` +
    `\n` +
    `${nextSection}` +
    `## Architecture & Conventions\n` +
    `\n` +
    `- **Architecture Preset**: \`${preset}\`\n` +
    `- **Validation Mode**: \`${validation}\` (${VALIDATION_NOTES[validation] ?? VALIDATION_NOTES.strict})\n` +
    `- **Paths Resolution**: Resolve file locations via \`paths.*\` defined in \`lumen.config.json\` — never hardcode arbitrary alternative locations.\n` +
    `- **Feature Barrels**: Every feature directory (under \`${paths.features ?? "src/features"}/<feature>/\`) must re-export its public API via \`${barrelFile}\`.\n` +
    `- **Shared Imports**: Import shared utilities via \`@/shared\` (plus path aliases configured in tsconfig/jsconfig).\n` +
    `\n` +
    `## Component Taxonomy\n` +
    `\n` +
    `Components must be organized strictly according to \`lumen.config.json\` path mappings:\n` +
    `- **Atomic UI Primitives**: Base atoms and UI primitives (e.g. shadcn components) belong in \`paths.ui\` (\`${uiPath}\`).\n` +
    `- **Compound Components**: Shared composite components belong in \`paths.components\` (\`${componentsPath}\`).\n` +
    `- **Feature Components**: Domain-specific components belong inside their respective feature folder (e.g. \`${paths.features ?? "src/features"}/<feature>/components\`).\n` +
    `\n` +
    `Lumen CLI and AI agents must place primitive UI atoms under \`paths.ui\`, global compound components under \`paths.components\`, and feature-scoped components in their respective feature folders.\n` +
    `\n` +
    `## Path Mappings\n` +
    `\n` +
    `${pathLines}\n` +
    `\n` +
    `## Validation Harness\n` +
    `\n` +
    `Before finishing work, run each harness command defined in \`lumen.config.json\` \`harness.commands\` in order (${harnessSummary}):\n` +
    `\n` +
    `${harnessLines}\n`
  );
}

/**
 * Backward compatibility alias for renderAgentsMd.
 * @param {object} manifest - validated manifest v2
 * @returns {string}
 */
export function renderConventions(manifest) {
  return renderAgentsMd(manifest);
}

/**
 * Build deterministic agent context metadata.
 * Retained for backwards compatibility with tests and callers.
 * @param {object} manifest - validated manifest v2
 * @returns {{ agentsMd: string, conventionsMd: string }}
 */
export function buildAgentContext(manifest) {
  const agentsMd = renderAgentsMd(manifest);
  return {
    agentsMd,
    conventionsMd: agentsMd,
  };
}

/**
 * Emit AGENTS.md directly into project root.
 * Accepts either a validated manifest v2 or scaffolder responses.
 * Writes ${projectPath}/AGENTS.md with trailing newline. Byte-deterministic.
 * Does not emit duplicate JSON files or .lumen/ directory.
 * @param {string} projectPath - absolute path to scaffolded project
 * @param {object} manifestOrResponses
 * @returns {Promise<string>} absolute path to AGENTS.md
 */
export async function emitAgentContext(projectPath, manifestOrResponses) {
  const manifest = resolveManifest(manifestOrResponses);
  const content = renderAgentsMd(manifest);
  const filePath = path.join(projectPath, "AGENTS.md");
  await fsp.writeFile(filePath, content, "utf8");
  return filePath;
}
