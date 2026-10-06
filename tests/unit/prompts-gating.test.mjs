import test from "node:test";
import assert from "node:assert/strict";
import {
  isPromptVisible,
  filterCompatibleChoices,
  getDefaultResponses,
  sanitizeResponsesForFramework,
  normalizeFramework,
} from "../../src/engine/capabilities.js";
import { manifestToResponses, parseCliArgs } from "../../src/cli-args.js";
import { getUserInputs } from "../../src/prompts.js";

// ============================================================================
// 1. isPromptVisible tests
// ============================================================================

test("isPromptVisible: router is visible for React/Vite", () => {
  assert.equal(isPromptVisible("react:vite", "router"), true);
  assert.equal(isPromptVisible({ name: "react", variant: "vite" }, "router"), true);
  assert.equal(isPromptVisible("react", "router"), true);
});

test("isPromptVisible: router is hidden for Next.js App Router and Pages Router", () => {
  assert.equal(isPromptVisible("next:app-router", "router"), false);
  assert.equal(isPromptVisible({ name: "next", variant: "app-router" }, "router"), false);
  assert.equal(isPromptVisible("next", "router"), false);
  assert.equal(isPromptVisible("next:pages-router", "router"), false);
  assert.equal(isPromptVisible({ name: "next", variant: "pages-router" }, "router"), false);
});

test("isPromptVisible: bundler and adapter are visible for Next frameworks, hidden for React/Vite", () => {
  // React/Vite: bundler and adapter are hidden
  assert.equal(isPromptVisible("react:vite", "bundler"), false);
  assert.equal(isPromptVisible("react:vite", "adapter"), false);

  // Next App Router: bundler and adapter are visible
  assert.equal(isPromptVisible("next:app-router", "bundler"), true);
  assert.equal(isPromptVisible("next:app-router", "adapter"), true);

  // Next Pages Router: bundler and adapter are visible
  assert.equal(isPromptVisible("next:pages-router", "bundler"), true);
  assert.equal(isPromptVisible("next:pages-router", "adapter"), true);
});

test("isPromptVisible: standard prompts are visible for both React and Next frameworks", () => {
  const frameworks = [
    "react:vite",
    { name: "react", variant: "vite" },
    "next:app-router",
    "next:pages-router",
  ];

  const standardPrompts = [
    "architecture",
    "language",
    "styling",
    "cssFramework",
    "testing",
    "stateManagement",
    "iconLibrary",
    "apiClient",
    "linter",
    "formatter",
    "docsLanguage",
    "gitInit",
    "readme",
  ];

  for (const fw of frameworks) {
    for (const prompt of standardPrompts) {
      assert.equal(
        isPromptVisible(fw, prompt),
        true,
        `Expected ${prompt} to be visible for ${typeof fw === "string" ? fw : fw.name + ":" + fw.variant}`
      );
    }
  }
});

// ============================================================================
// 2. filterCompatibleChoices tests
// ============================================================================

test("filterCompatibleChoices: architecture type-based compatible with React/Vite, excluded with Next App Router", () => {
  const choices = [
    { label: "Feature-based", value: "feature-based" },
    { label: "Type-based", value: "type-based" },
    { label: "Hybrid", value: "hybrid" },
    { label: "None", value: "none" },
  ];

  // React/Vite: allows feature-based, type-based, none; excludes hybrid
  const reactChoices = filterCompatibleChoices("react:vite", "architecture", choices);
  const reactValues = reactChoices.map((c) => c.value);
  assert.deepEqual(reactValues, ["feature-based", "type-based", "none"]);
  assert.equal(reactValues.includes("type-based"), true);

  // Next App Router: allows feature-based, hybrid, none; excludes type-based
  const nextChoices = filterCompatibleChoices("next:app-router", "architecture", choices);
  const nextValues = nextChoices.map((c) => c.value);
  assert.deepEqual(nextValues, ["feature-based", "hybrid", "none"]);
  assert.equal(nextValues.includes("type-based"), false);

  // Primitive strings array also works
  const primitiveChoices = ["feature-based", "type-based", "hybrid", "none"];
  const reactPrimitives = filterCompatibleChoices("react:vite", "architecture", primitiveChoices);
  assert.deepEqual(reactPrimitives, ["feature-based", "type-based", "none"]);
  const nextPrimitives = filterCompatibleChoices("next:app-router", "architecture", primitiveChoices);
  assert.deepEqual(nextPrimitives, ["feature-based", "hybrid", "none"]);
});

test("filterCompatibleChoices: styling bootstrap excluded everywhere post-#51 (Tailwind-first)", () => {
  const stylingChoices = [
    { label: "Tailwind CSS", value: "tailwind" },
    { label: "Bootstrap", value: "bootstrap" },
    { label: "None", value: "none" },
  ];

  // React/Vite: excludes bootstrap
  const reactStyling = filterCompatibleChoices("react:vite", "styling", stylingChoices);
  assert.deepEqual(
    reactStyling.map((c) => c.value),
    ["tailwind", "none"]
  );

  // Next Pages Router: excludes bootstrap
  const pagesStyling = filterCompatibleChoices("next:pages-router", "styling", stylingChoices);
  assert.deepEqual(
    pagesStyling.map((c) => c.value),
    ["tailwind", "none"]
  );

  // Next App Router: excludes bootstrap
  const appStyling = filterCompatibleChoices("next:app-router", "styling", stylingChoices);
  assert.deepEqual(
    appStyling.map((c) => c.value),
    ["tailwind", "none"]
  );

  // Also check cssFramework alias
  const appCss = filterCompatibleChoices("next:app-router", "cssFramework", stylingChoices);
  assert.deepEqual(
    appCss.map((c) => c.value),
    ["tailwind", "none"]
  );
});

test("filterCompatibleChoices: linter oxlint compatible with React/Vite, excluded with Next", () => {
  const linterChoices = [
    { label: "ESLint", value: "eslint" },
    { label: "Oxlint", value: "oxlint" },
    { label: "Biome", value: "biome" },
    { label: "None", value: "none" },
  ];

  // React/Vite: includes oxlint
  const reactLinters = filterCompatibleChoices("react:vite", "linter", linterChoices);
  assert.deepEqual(
    reactLinters.map((c) => c.value),
    ["eslint", "oxlint", "biome", "none"]
  );

  // Next App Router: excludes oxlint
  const nextAppLinters = filterCompatibleChoices("next:app-router", "linter", linterChoices);
  assert.deepEqual(
    nextAppLinters.map((c) => c.value),
    ["eslint", "biome", "none"]
  );

  // Next Pages Router: excludes oxlint
  const nextPagesLinters = filterCompatibleChoices("next:pages-router", "linter", linterChoices);
  assert.deepEqual(
    nextPagesLinters.map((c) => c.value),
    ["eslint", "biome", "none"]
  );
});

test("filterCompatibleChoices: formatter oxfmt compatible with React/Vite, excluded with Next", () => {
  const formatterChoices = [
    { label: "Prettier", value: "prettier" },
    { label: "Oxfmt", value: "oxfmt" },
    { label: "None", value: "none" },
  ];

  // React/Vite: includes oxfmt
  const reactFormatters = filterCompatibleChoices("react:vite", "formatter", formatterChoices);
  assert.deepEqual(
    reactFormatters.map((c) => c.value),
    ["prettier", "oxfmt", "none"]
  );

  // Next App Router: excludes oxfmt
  const nextAppFormatters = filterCompatibleChoices("next:app-router", "formatter", formatterChoices);
  assert.deepEqual(
    nextAppFormatters.map((c) => c.value),
    ["prettier", "none"]
  );

  // Next Pages Router: excludes oxfmt
  const nextPagesFormatters = filterCompatibleChoices("next:pages-router", "formatter", formatterChoices);
  assert.deepEqual(
    nextPagesFormatters.map((c) => c.value),
    ["prettier", "none"]
  );
});

// ============================================================================
// 3. getDefaultResponses tests
// ============================================================================

test("getDefaultResponses: React/Vite returns router: true, frameworkName: react, frameworkVariant: vite", () => {
  const defaults = getDefaultResponses("react:vite", { projectName: "my-react-app" });

  assert.equal(defaults.projectName, "my-react-app");
  assert.equal(defaults.frameworkName, "react");
  assert.equal(defaults.frameworkVariant, "vite");
  assert.equal(defaults.router, true);
  assert.equal(defaults.architecture, "feature-based");
  assert.equal(defaults.language, "ts");
  assert.equal(defaults.cssFramework, "tailwind");
  assert.equal(defaults.testing, "vitest");
  assert.equal(defaults.linter, "eslint");
  assert.equal(defaults.formatter, "prettier");
});

test("getDefaultResponses: Next App Router returns router: false, bundler: turbopack, adapter: none", () => {
  const defaults = getDefaultResponses("next:app-router", { projectName: "my-next-app" });

  assert.equal(defaults.projectName, "my-next-app");
  assert.equal(defaults.frameworkName, "next");
  assert.equal(defaults.frameworkVariant, "app-router");
  assert.equal(defaults.router, false);
  assert.equal(defaults.bundler, "turbopack");
  assert.equal(defaults.adapter, "none");
  assert.equal(defaults.architecture, "feature-based");
  assert.equal(defaults.language, "ts");
  assert.equal(defaults.cssFramework, "tailwind");
});

test("getDefaultResponses: Next Pages Router returns router: false, bundler: turbopack, adapter: none", () => {
  const defaults = getDefaultResponses("next:pages-router", { projectName: "my-pages-app" });

  assert.equal(defaults.projectName, "my-pages-app");
  assert.equal(defaults.frameworkName, "next");
  assert.equal(defaults.frameworkVariant, "pages-router");
  assert.equal(defaults.router, false);
  assert.equal(defaults.bundler, "turbopack");
  assert.equal(defaults.adapter, "none");
});

// ============================================================================
// 4. sanitizeResponsesForFramework tests
// ============================================================================

test("sanitizeResponsesForFramework: resets router: false and architecture: feature-based for Next App Router", () => {
  const responses = {
    projectName: "custom-next-app",
    router: true,
    architecture: "type-based",
    language: "ts",
    cssFramework: "tailwind",
  };

  const sanitized = sanitizeResponsesForFramework("next:app-router", responses);

  assert.equal(sanitized.router, false);
  assert.equal(sanitized.architecture, "feature-based");
  assert.equal(sanitized.language, "ts");
  assert.equal(sanitized.cssFramework, "tailwind");
});

test("sanitizeResponsesForFramework: resets incompatible styling, linter, and formatter for Next App Router", () => {
  const responses = {
    projectName: "app-with-unsupported-tools",
    router: true,
    architecture: "feature-based",
    cssFramework: "bootstrap",
    linter: "oxlint",
    formatter: "oxfmt",
  };

  const sanitized = sanitizeResponsesForFramework("next:app-router", responses);

  assert.equal(sanitized.router, false);
  assert.equal(sanitized.cssFramework, "tailwind");
  assert.equal(sanitized.linter, "eslint");
  assert.equal(sanitized.formatter, "prettier");
});

test("sanitizeResponsesForFramework: preserves valid compatible choices for React/Vite", () => {
  const responses = {
    projectName: "react-app",
    router: true,
    architecture: "type-based",
    cssFramework: "bootstrap",
    linter: "oxlint",
    formatter: "oxfmt",
  };

  const sanitized = sanitizeResponsesForFramework("react:vite", responses);

  assert.equal(sanitized.router, true);
  assert.equal(sanitized.architecture, "type-based");
  assert.equal(sanitized.cssFramework, "tailwind"); // post-#51: bootstrap reset even for React/Vite
  assert.equal(sanitized.linter, "oxlint");
  assert.equal(sanitized.formatter, "oxfmt");
});

// ============================================================================
// 5. manifestToResponses tests
// ============================================================================

test("manifestToResponses: React/Vite manifest produces router: true", () => {
  const manifest = {
    manifestVersion: 2,
    framework: {
      name: "react",
      variant: "vite",
    },
    architecture: {
      preset: "feature-based",
      type: "feature-based",
    },
    styling: {
      engine: "tailwind",
    },
    tooling: {
      language: "ts",
      linter: "eslint",
      formatter: "prettier",
    },
  };

  const responses = manifestToResponses(manifest, "test-react-app");
  assert.equal(responses.frameworkName, "react");
  assert.equal(responses.frameworkVariant, "vite");
  assert.equal(responses.router, true);
});

test("manifestToResponses: Next App Router manifest produces router: false", () => {
  const manifest = {
    manifestVersion: 2,
    framework: {
      name: "next",
      variant: "app-router",
      bundler: "turbopack",
      adapter: "node",
    },
    architecture: {
      preset: "feature-based",
      type: "feature-based",
    },
    styling: {
      engine: "tailwind",
    },
    tooling: {
      language: "ts",
      linter: "eslint",
      formatter: "prettier",
    },
  };

  const responses = manifestToResponses(manifest, "test-next-app");
  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "app-router");
  assert.equal(responses.router, false);
  assert.equal(responses.bundler, "turbopack");
  assert.equal(responses.adapter, "node");
});

test("manifestToResponses: Next Pages Router manifest produces router: false", () => {
  const manifest = {
    manifestVersion: 2,
    framework: {
      name: "next",
      variant: "pages-router",
      bundler: "webpack",
      adapter: "static",
    },
    architecture: {
      preset: "feature-based",
      type: "feature-based",
    },
    styling: {
      engine: "tailwind",
    },
    tooling: {
      language: "ts",
      linter: "eslint",
      formatter: "prettier",
    },
  };

  const responses = manifestToResponses(manifest, "test-next-pages");
  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "pages-router");
  assert.equal(responses.router, false);
  assert.equal(responses.bundler, "webpack");
  assert.equal(responses.adapter, "static");
});

// ============================================================================
// 6. parseCliArgs tests
// ============================================================================

test("parseCliArgs: --framework and -f flags are parsed correctly", () => {
  // Long flag --framework
  assert.equal(parseCliArgs(["--framework", "react:vite"]).framework, "react:vite");
  assert.equal(parseCliArgs(["--framework", "next:app-router"]).framework, "next:app-router");
  assert.equal(parseCliArgs(["--framework=next:pages-router"]).framework, "next:pages-router");

  // Short flag -f
  assert.equal(parseCliArgs(["-f", "react:vite"]).framework, "react:vite");
  assert.equal(parseCliArgs(["-f", "next:app-router"]).framework, "next:app-router");

  // Whitespace trimming
  assert.equal(parseCliArgs(["--framework", "  react:vite  "]).framework, "react:vite");

  // Default when omitted is null
  assert.equal(parseCliArgs([]).framework, null);
  assert.equal(parseCliArgs(["my-app", "-y"]).framework, null);
});

// ============================================================================
// 7. getUserInputs quickSetup gating tests
// ============================================================================

test("getUserInputs: default quickSetup preserves React/Vite flow and router: true", async () => {
  const responses = await getUserInputs("test-default-proj", { quickSetup: true });
  assert.equal(responses.projectName, "test-default-proj");
  assert.equal(responses.frameworkName, "react");
  assert.equal(responses.frameworkVariant, "vite");
  assert.equal(responses.router, true);
  assert.equal(responses.architecture, "feature-based");
  assert.equal(responses.cssFramework, "tailwind");
  assert.equal(responses.language, "ts");
});

test("getUserInputs: quickSetup with Next App Router hides router and sets router: false", async () => {
  const responses = await getUserInputs("test-next-proj", {
    quickSetup: true,
    framework: "next:app-router",
  });
  assert.equal(responses.projectName, "test-next-proj");
  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "app-router");
  assert.equal(responses.router, false);
  assert.equal(responses.bundler, "turbopack");
  assert.equal(responses.architecture, "feature-based");
  assert.equal(responses.cssFramework, "tailwind");
});

test("getUserInputs: quickSetup with Next Pages Router sets router: false", async () => {
  const responses = await getUserInputs("test-pages-proj", {
    quickSetup: true,
    framework: "next:pages-router",
  });
  assert.equal(responses.projectName, "test-pages-proj");
  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "pages-router");
  assert.equal(responses.router, false);
  assert.equal(responses.bundler, "turbopack");
});

test("isPromptVisible: reactCompiler is visible for Next App Router, hidden for React and Pages Router", () => {
  assert.equal(isPromptVisible("next:app-router", "reactCompiler"), true);
  assert.equal(isPromptVisible("react:vite", "reactCompiler"), false);
  assert.equal(isPromptVisible("next:pages-router", "reactCompiler"), false);
});

test("filterCompatibleChoices: linter includes biome for React and Next", () => {
  const choices = [
    { label: "ESLint", value: "eslint" },
    { label: "Biome", value: "biome" },
    { label: "Oxlint", value: "oxlint" },
    { label: "None", value: "none" },
  ];
  const reactLinters = filterCompatibleChoices("react:vite", "linter", choices).map((c) => c.value);
  assert.ok(reactLinters.includes("biome"));

  const nextLinters = filterCompatibleChoices("next:app-router", "linter", choices).map((c) => c.value);
  assert.ok(nextLinters.includes("biome"));
  assert.ok(!nextLinters.includes("oxlint"));
});

test("sanitizeResponsesForFramework: resets bundler, adapter, and reactCompiler for React/Vite", () => {
  const responses = {
    projectName: "react-app",
    bundler: "turbopack",
    adapter: "vercel",
    reactCompiler: true,
  };
  const sanitized = sanitizeResponsesForFramework("react:vite", responses);
  assert.equal(sanitized.bundler, undefined);
  assert.equal(sanitized.adapter, undefined);
  assert.equal(sanitized.reactCompiler, false);
});

