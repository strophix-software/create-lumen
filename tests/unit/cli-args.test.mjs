import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { promises as fsp } from "node:fs";
import os from "node:os";
import {
  parseCliArgs,
  loadManifestSource,
  manifestToResponses,
  PRESETS,
} from "../../src/cli-args.js";
import { resolveProjectName } from "../../src/main.js";

test("cli-args: flags and short aliases parse correctly", () => {
  assert.equal(parseCliArgs(["-y"]).quickSetup, true);
  assert.equal(parseCliArgs(["--yes"]).quickSetup, true);

  assert.equal(parseCliArgs(["-h"]).help, true);
  assert.equal(parseCliArgs(["--help"]).help, true);

  assert.equal(parseCliArgs(["-v"]).version, true);
  assert.equal(parseCliArgs(["--version"]).version, true);

  assert.equal(parseCliArgs(["-m", "foo.json"]).manifest, "foo.json");
  assert.equal(parseCliArgs(["--manifest", "bar.json"]).manifest, "bar.json");

  assert.equal(parseCliArgs(["-t", "react-ts"]).template, "react-ts");
  assert.equal(parseCliArgs(["--template", "react-js"]).template, "react-js");

  assert.equal(parseCliArgs(["-a", "none"]).arch, "none");
  assert.equal(parseCliArgs(["--arch", "hybrid"]).arch, "hybrid");
  assert.equal(parseCliArgs(["--architecture", "feature"]).arch, "feature-based");
  assert.equal(parseCliArgs(["-a", "component"]).arch, "type-based");
});

test("cli-args: positional projectName resolves independently of flag ordering", () => {
  // name after flag
  const r1 = parseCliArgs(["-y", "my-app"]);
  assert.equal(r1.projectName, "my-app");
  assert.equal(r1.quickSetup, true);

  // name before flag
  const r2 = parseCliArgs(["my-app", "-y"]);
  assert.equal(r2.projectName, "my-app");
  assert.equal(r2.quickSetup, true);

  // flag with value before name
  const r3 = parseCliArgs(["-m", "conf.json", "my-app"]);
  assert.equal(r3.projectName, "my-app");
  assert.equal(r3.manifest, "conf.json");

  // flag with value after name
  const r4 = parseCliArgs(["my-app", "--template", "react-ts"]);
  assert.equal(r4.projectName, "my-app");
  assert.equal(r4.template, "react-ts");

  // no name
  const r5 = parseCliArgs(["-y"]);
  assert.equal(r5.projectName, null);
  assert.equal(r5.quickSetup, true);
});

test("cli-args: resolveProjectName respects cli args", () => {
  const orig = process.argv;
  try {
    process.argv = ["node", "cli.js", "-y", "project-from-arg"];
    assert.equal(resolveProjectName(), "project-from-arg");

    process.argv = ["node", "cli.js", "-y"];
    assert.equal(resolveProjectName({ cwd: "/home/user/fallback-folder" }), "fallback-folder");
  } finally {
    process.argv = orig;
  }
});

test("cli-args: loadManifestSource parses inline JSON and validates schema", () => {
  const inline = JSON.stringify({
    manifestVersion: 2,
    framework: { name: "react", variant: "vite" },
    styling: { engine: "tailwind" },
    architecture: { type: "feature-based" },
    ui: { kit: "none" },
    docs: { language: "en" },
    paths: {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/components/ui",
    },
    tooling: { language: "ts", linter: "eslint", formatter: "prettier" },
  });

  const parsed = loadManifestSource(inline);
  assert.equal(parsed.manifestVersion, 2);
  assert.equal(parsed.framework.name, "react");
  assert.equal(parsed.tooling.language, "ts");
});

test("cli-args: loadManifestSource reads manifest file and validates schema", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-cli-manifest-"));
  const manifestPath = path.join(tmpDir, "lumen.config.json");
  const content = {
    manifestVersion: 2,
    framework: { name: "react", variant: "vite" },
    styling: { engine: "none" },
    architecture: { type: "type-based" },
    ui: { kit: "none" },
    docs: { language: "es" },
    paths: {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/components/ui",
    },
    tooling: { language: "js", linter: "oxlint", formatter: "oxfmt" },
  };
  await fsp.writeFile(manifestPath, JSON.stringify(content, null, 2), "utf8");

  const parsed = loadManifestSource(manifestPath);
  assert.equal(parsed.framework.name, "react");
  assert.equal(parsed.styling.engine, "none");
  assert.equal(parsed.architecture.type, "type-based");
  assert.equal(parsed.docs.language, "es");
});

test("cli-args: loadManifestSource rejects v1 flat manifests", () => {
  const v1 = JSON.stringify({
    framework: "react",
    css: "tailwind",
    architecture: "feature",
  });
  assert.throws(() => loadManifestSource(v1), /Manifest v1 detected/);
});

test("cli-args: manifestToResponses correctly maps manifest properties", () => {
  const manifest = {
    manifestVersion: 2,
    framework: { name: "react", variant: "vite" },
    styling: { engine: "tailwind" },
    architecture: { type: "feature-based" },
    ui: { kit: "none" },
    docs: { language: "en" },
    paths: {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/components/ui",
    },
    tooling: { language: "ts", linter: "eslint", formatter: "prettier" },
  };

  const responses = manifestToResponses(manifest, "test-app");
  assert.equal(responses.projectName, "test-app");
  assert.equal(responses.frameworkName, "react");
  assert.equal(responses.frameworkVariant, "vite");
  assert.equal(responses.architecture, "feature-based");
  assert.equal(responses.language, "ts");
  assert.equal(responses.cssFramework, "tailwind");
  assert.equal(responses.linter, "eslint");
  assert.equal(responses.formatter, "prettier");
  assert.equal(responses.router, true);
  assert.equal(responses._manifestSource, manifest);
});

test("cli-args: presets catalog contains valid presets", () => {
  assert.ok(PRESETS["react-ts"]);
  assert.ok(PRESETS["react-js"]);
  assert.ok(PRESETS["react-type-ts"]);
  assert.ok(PRESETS["react-type-js"]);
  assert.ok(PRESETS["react-component-ts"]);
  assert.ok(PRESETS["react-component-js"]);
  assert.equal(PRESETS["react-ts"].language, "ts");
  assert.equal(PRESETS["react-ts"].architecture, "feature-based");
  assert.equal(PRESETS["react-type-js"].language, "js");
  assert.equal(PRESETS["react-type-js"].architecture, "type-based");
  assert.equal(PRESETS["react-component-js"].language, "js");
  assert.equal(PRESETS["react-component-js"].architecture, "type-based");
  assert.ok(PRESETS["react-none-ts"]);
  assert.ok(PRESETS["react-none-js"]);
  assert.equal(PRESETS["react-none-ts"].architecture, "none");
  assert.equal(PRESETS["react-none-ts"].language, "ts");
  assert.equal(PRESETS["react-none-js"].architecture, "none");
  assert.equal(PRESETS["react-none-js"].language, "js");
  assert.ok(PRESETS["next-ts"]);
  assert.ok(PRESETS["next-pages-js"]);
  assert.equal(PRESETS["next-ts"].frameworkName, "next");
  assert.equal(PRESETS["next-ts"].frameworkVariant, "app-router");
  assert.equal(PRESETS["next-pages-js"].frameworkVariant, "pages-router");
});

test("cli-args: manifestToResponses defaults testing per framework", () => {
  const base = {
    manifestVersion: 2,
    styling: { engine: "tailwind" },
    architecture: { type: "feature-based" },
    ui: { kit: "none" },
    docs: { language: "en" },
    paths: {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/components/ui",
    },
    tooling: { language: "ts", linter: "eslint", formatter: "prettier" },
  };
  const next = manifestToResponses(
    { ...base, framework: { name: "next", variant: "app-router" } },
    "next-app"
  );
  assert.equal(next.testing, "none");
  const react = manifestToResponses(
    { ...base, framework: { name: "react", variant: "vite" } },
    "react-app"
  );
  assert.equal(react.testing, "vitest");
});

test("cli-args: parses bundler, adapter, react-compiler, agent-docs, and linter flags", () => {
  const parsed1 = parseCliArgs([
    "--framework", "next:app-router",
    "--bundler", "turbopack",
    "--adapter", "node",
    "--react-compiler",
    "--agent-docs",
    "--linter", "biome",
  ]);
  assert.equal(parsed1.framework, "next:app-router");
  assert.equal(parsed1.bundler, "turbopack");
  assert.equal(parsed1.adapter, "node");
  assert.equal(parsed1.reactCompiler, true);
  assert.equal(parsed1.agentDocs, true);
  assert.equal(parsed1.linter, "biome");

  const parsed2 = parseCliArgs(["-b", "webpack", "--adapter", "static"]);
  assert.equal(parsed2.bundler, "webpack");
  assert.equal(parsed2.adapter, "static");
});
