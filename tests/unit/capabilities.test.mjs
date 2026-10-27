import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITIES,
  hasCapability,
  isOptionCompatible,
  getCompatibleOptions,
  validateCompatibility,
} from "../../src/engine/capabilities.js";

test("capabilities: React/Vite declares expected capabilities", () => {
  const framework = { name: "react", variant: "vite" };
  assert.equal(hasCapability(framework, CAPABILITIES.CLIENT_ROUTING), true);
  assert.equal(hasCapability(framework, CAPABILITIES.SPA_FALLBACK), true);
  assert.equal(hasCapability(framework, CAPABILITIES.CLIENT_COMPONENTS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.FILESYSTEM_ROUTING), false);
  assert.equal(hasCapability(framework, CAPABILITIES.SERVER_COMPONENTS), false);
  assert.equal(hasCapability(framework, CAPABILITIES.ADAPTERS), false);
});

test("capabilities: Next.js App Router declares expected capabilities", () => {
  const framework = { name: "next", variant: "app-router" };
  assert.equal(hasCapability(framework, CAPABILITIES.FILESYSTEM_ROUTING), true);
  assert.equal(hasCapability(framework, CAPABILITIES.SERVER_COMPONENTS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.ROUTE_HANDLERS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.ADAPTERS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.BUNDLER_SELECTION), true);
  assert.equal(hasCapability(framework, CAPABILITIES.REACT_COMPILER), true);
  assert.equal(hasCapability(framework, CAPABILITIES.NEXT_FONT), true);
  assert.equal(hasCapability(framework, CAPABILITIES.NEXT_IMAGE), true);
});

test("capabilities: Next.js Pages Router declares expected capabilities", () => {
  const framework = { name: "next", variant: "pages-router" };
  assert.equal(hasCapability(framework, CAPABILITIES.FILESYSTEM_ROUTING), true);
  assert.equal(hasCapability(framework, CAPABILITIES.CLIENT_COMPONENTS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.API_ROUTES), true);
  assert.equal(hasCapability(framework, CAPABILITIES.SERVER_COMPONENTS), false);
  assert.equal(hasCapability(framework, CAPABILITIES.ADAPTERS), true);
});

test("capabilities: architecture compatibility per framework", () => {
  const react = { name: "react", variant: "vite" };
  const next = { name: "next", variant: "app-router" };

  // React/Vite
  assert.equal(isOptionCompatible(react, "architecture", "feature-based"), true);
  assert.equal(isOptionCompatible(react, "architecture", "feature"), true);
  assert.equal(isOptionCompatible(react, "architecture", "type-based"), true);
  assert.equal(isOptionCompatible(react, "architecture", "component-based"), true);
  assert.equal(isOptionCompatible(react, "architecture", "component"), true);
  assert.equal(isOptionCompatible(react, "architecture", "none"), true);
  assert.equal(isOptionCompatible(react, "architecture", "hybrid"), false);

  // Next.js App Router
  assert.equal(isOptionCompatible(next, "architecture", "feature-based"), true);
  assert.equal(isOptionCompatible(next, "architecture", "hybrid"), false);
  assert.equal(isOptionCompatible(next, "architecture", "none"), true);
  assert.equal(isOptionCompatible(next, "architecture", "type-based"), false);

  // Next.js Pages Router
  const nextPages = { name: "next", variant: "pages-router" };
  assert.equal(isOptionCompatible(nextPages, "architecture", "feature-based"), true);
  assert.equal(isOptionCompatible(nextPages, "architecture", "hybrid"), false);
  assert.equal(isOptionCompatible(nextPages, "architecture", "none"), true);
  assert.equal(isOptionCompatible(nextPages, "architecture", "type-based"), false);
});

test("capabilities: router option gating (filesystem routing suppresses external router)", () => {
  const react = { name: "react", variant: "vite" };
  const next = { name: "next", variant: "app-router" };

  assert.equal(isOptionCompatible(react, "router", true), true);
  assert.equal(isOptionCompatible(next, "router", true), false);
  assert.equal(isOptionCompatible(next, "router", false), true);
});

test("capabilities: bundler and adapter compatibility", () => {
  const react = { name: "react", variant: "vite" };
  const next = { name: "next", variant: "app-router" };

  assert.equal(isOptionCompatible(react, "bundler", "turbopack"), false);
  assert.equal(isOptionCompatible(react, "adapter", "cloudflare"), false);

  assert.equal(isOptionCompatible(next, "bundler", "turbopack"), true);
  assert.equal(isOptionCompatible(next, "bundler", "webpack"), true);
  assert.equal(isOptionCompatible(next, "adapter", "cloudflare"), true);
  assert.equal(isOptionCompatible(next, "adapter", "vercel"), true);
});

test("capabilities: getCompatibleOptions returns structured descriptors", () => {
  const react = { name: "react", variant: "vite" };
  const opts = getCompatibleOptions(react);
  assert.ok(opts.architectures.includes("feature-based"));
  assert.ok(opts.architectures.includes("type-based"));
  assert.ok(!opts.architectures.includes("hybrid"));
  assert.equal(opts.supportsRouterPrompt, true);
});

test("capabilities: validateCompatibility catches incompatible configurations", () => {
  const react = { name: "react", variant: "vite" };
  const valid = validateCompatibility(react, {
    architecture: "feature-based",
    styling: "tailwind",
    linter: "eslint",
    formatter: "prettier",
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validateCompatibility(react, {
    architecture: "hybrid",
    bundler: "turbopack",
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 2);
});

test("capabilities: validateCompatibility rejects bad combos for React and Next", () => {
  const react = { name: "react", variant: "vite" };
  const nextApp = { name: "next", variant: "app-router" };
  const nextPages = { name: "next", variant: "pages-router" };

  // React rejects bundler, adapter, and reactCompiler
  const reactBad = validateCompatibility(react, {
    bundler: "turbopack",
    adapter: "vercel",
    reactCompiler: true,
  });
  assert.equal(reactBad.valid, false);
  assert.equal(reactBad.errors.length, 3);

  // Next App Router rejects invalid bundler, adapter, and external router
  const nextBad = validateCompatibility(nextApp, {
    bundler: "vite",
    adapter: "aws",
    router: true,
    linter: "oxlint",
    formatter: "oxfmt",
  });
  assert.equal(nextBad.valid, false);
  assert.equal(nextBad.errors.length, 5);

  // Next Pages Router rejects reactCompiler
  const pagesBadCompiler = validateCompatibility(nextPages, {
    reactCompiler: true,
  });
  assert.equal(pagesBadCompiler.valid, false);

  // Valid combinations
  const nextAppValid = validateCompatibility(nextApp, {
    architecture: "feature-based",
    bundler: "turbopack",
    adapter: "node",
    reactCompiler: true,
    linter: "biome",
  });
  assert.equal(nextAppValid.valid, true);

  const nextAppWebpackStatic = validateCompatibility(nextApp, {
    architecture: "feature-based",
    bundler: "webpack",
    adapter: "static",
    reactCompiler: false,
    linter: "eslint",
  });
  assert.equal(nextAppWebpackStatic.valid, true);

  const nextAppAdapterNone = validateCompatibility(nextApp, {
    bundler: "turbopack",
    adapter: "none",
  });
  assert.equal(nextAppAdapterNone.valid, true);

  const reactBiomeValid = validateCompatibility(react, {
    architecture: "feature-based",
    linter: "biome",
  });
  assert.equal(reactBiomeValid.valid, true);
});

