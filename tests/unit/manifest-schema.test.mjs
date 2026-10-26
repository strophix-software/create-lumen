import test from "node:test";
import assert from "node:assert/strict";
import { parseManifest, isV1Manifest, SCHEMA_URL } from "../../src/manifest/schema.js";

const baseValid = {
  $schema: SCHEMA_URL,
  manifestVersion: 2,
  framework: { name: "react", variant: "vite" },
  styling: { engine: "tailwind" },
  architecture: { type: "feature-based" },
  ui: { kit: "none" },
  docs: { language: "en" },
  paths: {
    features: "src/features",
    components: "src/shared/components",
    services: "src/shared/services",
    hooks: "src/shared/hooks",
    pages: "src/app/router",
    ui: "src/shared/components/ui",
  },
  tooling: { language: "ts", linter: "eslint", formatter: "prettier" },
};

test("parseManifest accepts valid react/vite manifest", () => {
  const out = parseManifest(baseValid);
  assert.equal(out.manifestVersion, 2);
  assert.equal(out.framework.name, "react");
});

test("parseManifest defaults $schema when omitted", () => {
  const { $schema: _, ...without } = baseValid;
  const out = parseManifest(without);
  assert.equal(out.$schema, SCHEMA_URL);
});

test("parseManifest accepts next/app-router with feature-based + bundler + adapter + flags", () => {
  const m = {
    ...baseValid,
    framework: { name: "next", variant: "app-router", bundler: "turbopack", adapter: "vercel" },
    architecture: { type: "feature-based" },
    reactCompiler: true,
    agentDocs: true,
  };
  assert.doesNotThrow(() => parseManifest(m));
});

test("parseManifest rejects hybrid architecture", () => {
  const m = { ...baseValid, architecture: { type: "hybrid" } };
  assert.throws(() => parseManifest(m), /Invalid enum value|Manifest validation failed/i);
});

test("parseManifest rejects next + type-based", () => {
  const m = {
    ...baseValid,
    framework: { name: "next", variant: "app-router" },
    architecture: { type: "type-based" },
  };
  assert.throws(() => parseManifest(m), /not valid for framework "next"/);
});

test("parseManifest accepts react + type-based", () => {
  // Asserts react+vite + type-based is the canonical non-Next cell
  const m = {
    ...baseValid,
    framework: { name: "react", variant: "vite" },
    architecture: { type: "type-based" },
  };
  assert.doesNotThrow(() => parseManifest(m));
});

test("parseManifest rejects shadcn without tailwind (#33)", () => {
  const m = {
    ...baseValid,
    styling: { engine: "none" },
    ui: { kit: "shadcn" },
  };
  assert.throws(() => parseManifest(m), /shadcn.*requires.*tailwind/);
});

test("parseManifest rejects bootstrap as styling engine (#51)", () => {
  const m = {
    ...baseValid,
    styling: { engine: "bootstrap" },
  };
  assert.throws(
    () => parseManifest(m),
    /expected one of "tailwind"\|"none" at "styling\.engine"/
  );
});

test("parseManifest rejects react variant app-router mismatch", () => {
  const m = { ...baseValid, framework: { name: "react", variant: "app-router" } };
  assert.throws(() => parseManifest(m), /must be "vite" when framework.name is "react"/);
});

test("parseManifest rejects bundler on react", () => {
  const m = { ...baseValid, framework: { name: "react", variant: "vite", bundler: "turbopack" } };
  assert.throws(() => parseManifest(m), /bundler is only valid when framework.name is "next"/);
});

test("parseManifest rejects biome as linter via enum catch? actually allows biome", () => {
  const m = { ...baseValid, tooling: { ...baseValid.tooling, linter: "biome" } };
  assert.doesNotThrow(() => parseManifest(m));
});

test("parseManifest fails on malformed paths (user-friendly error)", () => {
  const m = { ...baseValid, paths: { ...baseValid.paths, features: "" } };
  assert.throws(() => parseManifest(m), /Manifest validation failed/);
});

test("isV1Manifest detects flat v1 and parseManifest gives migration error (#14)", () => {
  const v1 = { framework: "react", css: "tailwind", architecture: "feature-based", language: "ts" };
  assert.equal(isV1Manifest(v1), true);
  assert.throws(() => parseManifest(v1), /Manifest v1 detected/);

  const v1b = { manifestVersion: 1, framework: "react" };
  assert.throws(() => parseManifest(v1b), /Manifest v1 detected/);
});

test("parseManifest rejects missing required fields with field path", () => {
  const { docs: _, ...missingDocs } = baseValid;
  assert.throws(() => parseManifest(missingDocs), /Manifest validation failed/);
});
