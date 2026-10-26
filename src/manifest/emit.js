import { promises as fsp } from "fs";
import path from "path";
import { parseManifest, SCHEMA_URL, MANIFEST_VERSION, HARNESS_DEFAULT_COMMANDS } from "./schema.js";
import { resolvePaths } from "./paths.js";

const LINT_COMMANDS = {
  eslint: "eslint .",
  oxlint: "oxlint .",
  biome: "biome check .",
};

const FORMAT_COMMANDS = {
  prettier: "prettier --check .",
  oxfmt: "oxfmt --check .",
};

/**
 * Build default harness commands from tooling choices.
 * Skips lint/format when tooling is "none"; skips types when language is not "ts".
 * Test + build are always included so commands.length >= 1.
 * @param {{ linter?: string, formatter?: string, language?: string }} tooling
 * @returns {Array<{ name: string, command: string, required: boolean }>}
 */
export function defaultHarnessCommands(tooling = {}) {
  const { linter = "none", formatter = "none", language = "ts" } = tooling;
  const commands = [];
  if (linter && linter !== "none" && LINT_COMMANDS[linter]) {
    commands.push({ name: "lint", command: LINT_COMMANDS[linter], required: true });
  }
  if (formatter && formatter !== "none" && FORMAT_COMMANDS[formatter]) {
    commands.push({ name: "format", command: FORMAT_COMMANDS[formatter], required: true });
  }
  if (language === "ts") {
    commands.push({ name: "types", command: "tsc -b", required: true });
  }
  commands.push({ name: "test", command: "vitest run", required: true });
  commands.push({ name: "build", command: "npm run build", required: true });
  return commands.length > 0 ? commands : [...HARNESS_DEFAULT_COMMANDS];
}

/**
 * Build an ordered manifest v2 object from scaffolder responses.
 * Stable key ordering for byte-determinism.
 * @param {object} responses - result from getUserInputs (includes docsLanguage, cssFramework, etc.)
 * @param {object} [opts]
 * @param {string} [opts.frameworkName] - default "react"
 * @param {string} [opts.frameworkVariant] - default "vite" or derived from framework
 * @returns {object} ordered manifest object ready to JSON.stringify
 */
export function buildManifest(responses, opts = {}) {
  if (responses.rawManifest) {
    return parseManifest(responses.rawManifest);
  }

  const frameworkName = opts.frameworkName || responses.frameworkName || "react";
  const frameworkVariant =
    opts.frameworkVariant ||
    responses.frameworkVariant ||
    (frameworkName === "next" ? "app-router" : "vite");

  const framework = {
    name: frameworkName,
    variant: frameworkVariant,
  };
  // Include optional axes only if present in responses (future overlays)
  if (responses.bundler) framework.bundler = responses.bundler;
  if (responses.adapter && responses.adapter !== "none") framework.adapter = responses.adapter;

  const styling = {
    engine: responses.cssFramework || "tailwind",
  };

  const rawArch =
    responses.architecturePreset || responses.architecture || "feature-based";
  const normalizedArch = rawArch === "component-based" ? "type-based" : rawArch;
  const architecture = {
    preset: normalizedArch,
    type: normalizedArch,
    validation:
      responses.architectureValidation || responses.validation || "strict",
  };

  const ui = {
    kit: responses.uiKit || responses.ui || "none",
  };

  const docs = {
    language: responses.docsLanguage || "en",
  };

  const paths = resolvePaths({
    architecture: architecture.type,
    framework,
  });

  const tooling = {
    language: responses.language || "ts",
    linter: responses.linter || "none",
    formatter: responses.formatter || "none",
  };

  const harness = responses.harness ?? {
    commands: defaultHarnessCommands(tooling),
  };

  const manifest = {
    $schema: SCHEMA_URL,
    manifestVersion: MANIFEST_VERSION,
    framework,
    styling,
    architecture,
    harness,
    ui,
    docs,
    paths,
    tooling,
  };

  // Optional cross-cutting flags — only include if explicitly set (keeps minimal manifest byte-stable)
  if (responses.database && responses.database !== "none") {
    manifest.database = {
      orm: responses.database,
      provider: "postgresql",
    };
  }
  if (typeof responses.docker === "boolean") manifest.docker = responses.docker;
  if (typeof responses.routeGroups === "boolean") manifest.routeGroups = responses.routeGroups;
  if (typeof responses.reactCompiler === "boolean") manifest.reactCompiler = responses.reactCompiler;
  if (typeof responses.routeGroups === "boolean") manifest.routeGroups = responses.routeGroups;
  if (typeof responses.agentDocs === "boolean") manifest.agentDocs = responses.agentDocs;
  if (typeof responses.docker === "boolean") manifest.docker = responses.docker;

  // Enforce stable top-level key order for determinism (like formatter pass)
  const ordered = {};
  const topOrder = [
    "$schema",
    "manifestVersion",
    "framework",
    "styling",
    "architecture",
    "harness",
    "ui",
    "docs",
    "paths",
    "tooling",
    "database",
    "docker",
    "routeGroups",
    "reactCompiler",
    "agentDocs",
  ];
  for (const k of topOrder) {
    if (k in manifest) ordered[k] = manifest[k];
  }
  // Include any extra keys not in order (should be none, but for forward compat)
  for (const k of Object.keys(manifest)) {
    if (!(k in ordered)) ordered[k] = manifest[k];
  }

  // Validate via Zod before returning (throws with user-friendly message on invalid)
  // Use parse to apply defaults ($schema) and ensure strictness
  return parseManifest(ordered);
}

/**
 * Emit lumen.config.json to projectPath.
 * Validates via Zod, writes with 2-space indent + trailing newline.
 * @param {string} projectPath - absolute path to scaffolded project
 * @param {object} responses
 * @param {object} [opts] - same as buildManifest opts
 * @returns {Promise<string>} absolute path to written file
 */
export async function emitManifest(projectPath, responses, opts = {}) {
  const manifest = responses._manifestSource || buildManifest(responses, opts);
  const outPath = path.join(projectPath, "lumen.config.json");
  const content = JSON.stringify(manifest, null, 2) + "\n";
  await fsp.writeFile(outPath, content, "utf8");
  return outPath;
}
