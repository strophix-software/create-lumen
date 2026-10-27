import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { buildManifest, emitManifest } from "../../src/manifest/emit.js";
import { parseManifest, SCHEMA_URL } from "../../src/manifest/schema.js";

const baseResponses = {
  projectName: "my-app",
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
  gitInit: false,
  readme: false,
};

test("buildManifest: produces valid v2 manifest with $schema and correct paths", () => {
  const m = buildManifest(baseResponses);
  assert.equal(m.$schema, SCHEMA_URL);
  assert.equal(m.manifestVersion, 2);
  assert.equal(m.framework.name, "react");
  assert.equal(m.framework.variant, "vite");
  assert.equal(m.styling.engine, "tailwind");
  assert.equal(m.architecture.type, "feature-based");
  assert.equal(m.docs.language, "en");
  assert.equal(m.paths.features, "src/features");
  assert.equal(m.paths.pages, "src/app/router");
  assert.equal(m.tooling.language, "ts");
  // Ensure Zod validates
  assert.doesNotThrow(() => parseManifest(m));
});

test("buildManifest: type-based maps to src/pages etc", () => {
  const m = buildManifest({ ...baseResponses, architecture: "type-based" });
  assert.equal(m.architecture.type, "type-based");
  assert.equal(m.paths.components, "src/components");
  assert.equal(m.paths.pages, "src/pages");
  assert.equal(m.paths.ui, "src/ui");
});

test("buildManifest: legacy component-based normalizes to type-based", () => {
  const m = buildManifest({ ...baseResponses, architecture: "component-based" });
  assert.equal(m.architecture.type, "type-based");
  assert.equal(m.paths.components, "src/components");
  assert.equal(m.paths.pages, "src/pages");
  assert.equal(m.paths.ui, "src/ui");
});

test("buildManifest: es docsLanguage + none styling + none linter", () => {
  const m = buildManifest({ ...baseResponses, docsLanguage: "es", cssFramework: "none", linter: "none", formatter: "none" });
  assert.equal(m.docs.language, "es");
  assert.equal(m.styling.engine, "none");
  assert.equal(m.tooling.linter, "none");
});

test("buildManifest: stable key ordering", () => {
  const m = buildManifest(baseResponses);
  const keys = Object.keys(m);
  const expected = ["$schema", "manifestVersion", "framework", "styling", "architecture", "harness", "ui", "docs", "paths", "tooling"];
  assert.deepEqual(keys, expected);
});

test("emitManifest: writes lumen.config.json with trailing newline and byte-determinism", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-emit-"));
  const out = await emitManifest(dir, baseResponses);
  const content1 = await fsp.readFile(out, "utf8");
  assert.ok(content1.endsWith("\n"), "must end with newline");
  assert.ok(content1.includes('"$schema"'), "must contain $schema");
  const parsed = JSON.parse(content1);
  assert.doesNotThrow(() => parseManifest(parsed));

  // Byte-identical across double emission
  await emitManifest(dir, baseResponses);
  const content2 = await fsp.readFile(out, "utf8");
  assert.equal(content1, content2, "double emission must be byte-identical");
});

test("emitManifest: passes Zod validator for every generated cell (feature/type x ts/js)", async () => {
  for (const arch of ["feature-based", "type-based", "component-based"]) {
    for (const lang of ["ts", "js"]) {
      const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-emit-cell-"));
      await emitManifest(dir, { ...baseResponses, architecture: arch, language: lang });
      const raw = JSON.parse(await fsp.readFile(path.join(dir, "lumen.config.json"), "utf8"));
      assert.doesNotThrow(() => parseManifest(raw), `failed for ${arch}/${lang}`);
    }
  }
});

test("buildManifest: harness commands reflect testing choice accurately", () => {
  // 1. testing: "none" produces no test command in harness
  const mNone = buildManifest({ ...baseResponses, testing: "none" });
  assert.equal(
    mNone.harness.commands.some((c) => c.name === "test"),
    false,
    "must not include test command when testing is none"
  );
  assert.ok(
    mNone.harness.commands.some((c) => c.name === "build"),
    "build command must still be present"
  );

  // 2. testing: "vitest" produces vitest run
  const mVitest = buildManifest({ ...baseResponses, testing: "vitest" });
  const vitestCmd = mVitest.harness.commands.find((c) => c.name === "test");
  assert.ok(vitestCmd, "test command must exist for vitest");
  assert.equal(vitestCmd.command, "vitest run");

  // 3. testing: "jest" produces npm test
  const mJest = buildManifest({ ...baseResponses, testing: "jest" });
  const jestCmd = mJest.harness.commands.find((c) => c.name === "test");
  assert.ok(jestCmd, "test command must exist for jest");
  assert.equal(jestCmd.command, "npm test");

  // 4. Next.js without explicit testing defaults to none and produces no test command
  const mNext = buildManifest({
    ...baseResponses,
    frameworkName: "next",
    frameworkVariant: "app-router",
    testing: undefined,
  });
  assert.equal(
    mNext.harness.commands.some((c) => c.name === "test"),
    false,
    "Next.js without explicit testing must default to none"
  );
});
