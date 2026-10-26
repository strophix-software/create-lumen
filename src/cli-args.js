import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { parseManifest } from "./manifest/schema.js";
import {
  normalizeFramework,
  isPromptVisible,
} from "./engine/capabilities.js";

export const PRESETS = {
  "react-ts": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-vite-ts": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-js": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-vite-js": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-type-ts": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "type-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-type-js": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "type-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-component-ts": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "type-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-component-js": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "type-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-none-ts": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "none",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "react-none-js": {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "none",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "next-ts": {
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    bundler: "turbopack",
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "next-js": {
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    bundler: "turbopack",
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "next-pages-ts": {
    frameworkName: "next",
    frameworkVariant: "pages-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    bundler: "turbopack",
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
  "next-pages-js": {
    frameworkName: "next",
    frameworkVariant: "pages-router",
    architecture: "feature-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "vitest",
    router: false,
    bundler: "turbopack",
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  },
};

/**
 * Parse CLI arguments using standard node:util parseArgs.
 * @param {string[]} [argv]
 * @returns {{
 *   projectName: string | null,
 *   quickSetup: boolean,
 *   manifest: string | null,
 *   template: string | null,
 *   framework: string | null,
 *   arch: string | null,
 *   help: boolean,
 *   version: boolean,
 *   positionals: string[]
 * }}
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      yes: { type: "boolean", short: "y", default: false },
      manifest: { type: "string", short: "m" },
      template: { type: "string", short: "t" },
      framework: { type: "string", short: "f" },
      arch: { type: "string", short: "a" },
      architecture: { type: "string" },
      bundler: { type: "string", short: "b" },
      adapter: { type: "string" },
      database: { type: "string" },
      db: { type: "string" },
      "react-compiler": { type: "boolean" },
      reactCompiler: { type: "boolean" },
      "route-groups": { type: "boolean" },
      routeGroups: { type: "boolean" },
      "agent-docs": { type: "boolean" },
      agentDocs: { type: "boolean" },
      docker: { type: "boolean" },
      linter: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const projectName = positionals[0] ? positionals[0].trim() : null;

  let arch = values.arch || values.architecture || null;
  if (arch) {
    arch = arch.trim().toLowerCase();
    if (arch === "feature") arch = "feature-based";
    else if (arch === "component" || arch === "component-based" || arch === "type") arch = "type-based";
  }

  const bundler = values.bundler ? values.bundler.trim().toLowerCase() : null;
  const adapter = values.adapter ? values.adapter.trim().toLowerCase() : null;
  let database = values.database || values.db || null;
  if (database) {
    database = database.trim().toLowerCase();
  }
  const reactCompiler = values["react-compiler"] ?? values.reactCompiler ?? null;
  const routeGroups = values["route-groups"] ?? values.routeGroups ?? null;
  const agentDocs = values["agent-docs"] ?? values.agentDocs ?? null;
  const docker = Boolean(values.docker);
  const linter = values.linter ? values.linter.trim().toLowerCase() : null;

  return {
    projectName,
    quickSetup: Boolean(values.yes),
    manifest: values.manifest || null,
    template: values.template || null,
    framework: values.framework ? values.framework.trim() : null,
    arch,
    bundler,
    adapter,
    database,
    reactCompiler,
    routeGroups,
    agentDocs,
    docker,
    linter,
    help: Boolean(values.help),
    version: Boolean(values.version),
    positionals,
  };
}

/**
 * Load and validate a manifest from a file path or raw inline JSON string.
 * @param {string} source - file path or inline JSON
 * @param {string} [cwd=process.cwd()]
 * @returns {object} validated manifest v2 object
 */
export function loadManifestSource(source, cwd = process.cwd()) {
  const trimmed = source.trim();
  let parsed;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Failed to parse inline manifest JSON: ${err.message}`, { cause: err });
    }
  } else {
    const filePath = path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
    try {
      const content = readFileSync(filePath, "utf8");
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to read manifest file "${filePath}": ${err.message}`, { cause: err });
    }
  }

  // Validate strictly against schema v2; throws if v1 or invalid
  return parseManifest(parsed);
}

/**
 * Map a validated v2 manifest into scaffolder response options.
 * @param {object} manifest - validated manifest v2
 * @param {string} projectName
 * @returns {object} scaffolder response set
 */
export function manifestToResponses(manifest, projectName) {
  const frameworkName = manifest.framework?.name || "react";
  const frameworkVariant = manifest.framework?.variant || "vite";
  const framework = normalizeFramework({ name: frameworkName, variant: frameworkVariant });
  const canClientRoute = isPromptVisible(framework, "router");
  const supportsBundler = isPromptVisible(framework, "bundler");
  const supportsAdapter = isPromptVisible(framework, "adapter");
  const supportsDatabase = isPromptVisible(framework, "database");
  const supportsCompiler = isPromptVisible(framework, "reactCompiler");
  const supportsRouteGroups = isPromptVisible(framework, "routeGroups");
  const supportsDocker = isPromptVisible(framework, "docker");

  return {
    projectName,
    frameworkName,
    frameworkVariant,
    bundler:
      supportsBundler && manifest.framework?.bundler
        ? manifest.framework.bundler
        : undefined,
    adapter:
      supportsAdapter && manifest.framework?.adapter
        ? manifest.framework.adapter
        : undefined,
    database:
      supportsDatabase && manifest.database?.orm
        ? manifest.database.orm
        : "none",
    architecture: manifest.architecture?.type || "feature-based",
    language: manifest.tooling?.language || "ts",
    cssFramework: manifest.styling?.engine || "tailwind",
    linter: manifest.tooling?.linter || "eslint",
    formatter: manifest.tooling?.formatter || "prettier",
    uiKit: manifest.ui?.kit || "none",
    docsLanguage: manifest.docs?.language || "en",
    reactCompiler: supportsCompiler ? manifest.reactCompiler : undefined,
    routeGroups: supportsRouteGroups ? manifest.routeGroups : undefined,
    agentDocs: manifest.agentDocs,
    docker: supportsDocker ? (manifest.docker ?? false) : false,
    // Sensible defaults for scaffolder conditional passes (Next.js ships no
    // verified test-runner overlay yet, so it defaults to none; explicit
    // vitest/jest selection still applies the standard overlays)
    testing: frameworkName === "next" ? "none" : "vitest",
    router: canClientRoute,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    gitInit: true,
    readme: true,
    _manifestSource: manifest,
  };
}

/**
 * Print styled CLI help message.
 */
export function printHelp() {
  console.log(`
${chalk.bold.cyan("  create-lumen")} — Scaffold a React + Vite project with architecture choice

${chalk.bold("USAGE")}
  ${chalk.green("$")} ${chalk.bold("create-lumen")} [project-name] [options]

${chalk.bold("OPTIONS")}
  ${chalk.yellow("-y, --yes")}              Quick setup with recommended defaults (TS + Tailwind + Router + ESLint + Prettier)
  ${chalk.yellow("-a, --arch")} <name>      Architecture preset (feature-based, type-based, none, hybrid)
  ${chalk.yellow("-m, --manifest")} <path>  Drive scaffolding from a lumen.config.json or inline JSON
  ${chalk.yellow("-t, --template")} <name>  Scaffold using a preset (${Object.keys(PRESETS).join(", ")})
  ${chalk.yellow("-f, --framework")} <name> Target framework (react, next, react:vite, next:app-router, etc.)
  ${chalk.yellow("--db, --database")} <orm> Database ORM (prisma, none)
  ${chalk.yellow("    --docker")}           Include multi-stage Dockerfile & docker-compose for Next.js standalone
  ${chalk.yellow("--route-groups")}         Include Next.js route groups preset (public, auth, private, admin)
  ${chalk.yellow("-h, --help")}             Show this help message
  ${chalk.yellow("-v, --version")}          Show version number

${chalk.bold("PRESETS")}
  ${chalk.cyan("react-ts")}       React + Vite + TypeScript (feature-based)
  ${chalk.cyan("react-js")}       React + Vite + JavaScript (feature-based)
  ${chalk.cyan("react-type-ts")}  React + Vite + TypeScript (type-based)
  ${chalk.cyan("react-type-js")}  React + Vite + JavaScript (type-based)
  ${chalk.cyan("react-none-ts")}  React + Vite + TypeScript (none)
  ${chalk.cyan("react-none-js")}  React + Vite + JavaScript (none)
  ${chalk.cyan("next-ts")}         Next.js App Router + TypeScript (feature-based)
  ${chalk.cyan("next-js")}         Next.js App Router + JavaScript (feature-based)
  ${chalk.cyan("next-pages-ts")}   Next.js Pages Router + TypeScript (feature-based)
  ${chalk.cyan("next-pages-js")}   Next.js Pages Router + JavaScript (feature-based)

${chalk.bold("EXAMPLES")}
  ${chalk.gray("# Interactive setup")}
  ${chalk.green("$")} create-lumen my-app

  ${chalk.gray("# Non-interactive quick setup")}
  ${chalk.green("$")} create-lumen my-app -y
  ${chalk.green("$")} create-lumen -y my-app

  ${chalk.gray("# Scaffold from a template preset")}
  ${chalk.green("$")} create-lumen my-app --template react-ts

  ${chalk.gray("# Scaffold from a manifest file")}
  ${chalk.green("$")} create-lumen my-app --manifest ./lumen.config.json

  ${chalk.gray("# Scaffold from inline JSON manifest")}
  ${chalk.green("$")} create-lumen my-app -m '{"manifestVersion":2,"framework":{"name":"react","variant":"vite"},...}'
`);
}
