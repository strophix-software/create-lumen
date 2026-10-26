import test from "node:test";
import assert from "node:assert/strict";
import { parseManifest, isV1Manifest } from "../../src/manifest/schema.js";
import { loadValidFixtures, loadInvalidFixtures, getFixture } from "../../schema/fixtures/index.js";

test("manifest v2 contract tests: all valid fixtures pass validation (#28)", async (t) => {
  const validFixtures = await loadValidFixtures();
  assert.ok(validFixtures.length >= 10, `Expected at least 10 valid fixtures, found ${validFixtures.length}`);

  for (const { name, manifest } of validFixtures) {
    await t.test(`valid fixture parses successfully: ${name}`, () => {
      const parsed = parseManifest(manifest);
      assert.equal(parsed.manifestVersion, 2);
      assert.ok(parsed.framework.name === "react" || parsed.framework.name === "next");
      assert.ok(parsed.paths.features);
      assert.ok(parsed.paths.components);
      assert.ok(parsed.paths.services);
      assert.ok(parsed.paths.hooks);
      assert.ok(parsed.paths.pages);
      assert.ok(parsed.paths.ui);
      assert.ok(parsed.tooling.language);
      assert.ok(parsed.tooling.linter);
      assert.ok(parsed.tooling.formatter);
    });
  }
});

test("manifest v2 contract tests: invalid fixtures fail with expected errors (#28)", async (t) => {
  const invalidFixtures = await loadInvalidFixtures();
  assert.ok(invalidFixtures.length >= 10, `Expected at least 10 invalid fixtures, found ${invalidFixtures.length}`);

  const expectations = {
    "react-hybrid": /architecture\.type.*hybrid.*not valid for framework "react"/i,
    "next-type-based": /architecture\.type.*type-based.*not valid for framework "next"/i,
    "shadcn-without-tailwind": /ui\.kit "shadcn" requires styling\.engine "tailwind"/i,
    "react-variant-mismatch": /framework\.variant must be "vite" when framework\.name is "react"/i,
    "react-bundler": /framework\.bundler is only valid when framework\.name is "next"/i,
    "next-vite": /framework\.variant must be "app-router" or "pages-router" when framework\.name is "next"/i,
    "v1-flat-config": /Manifest v1 detected \(flat config\)/i,
    "missing-required-fields": /Manifest validation failed/i,
    "malformed-paths": /Manifest validation failed/i,
    "invalid-manifest-version": /Manifest validation failed/i,
    "harness-empty-commands": /harness\.commands/i,
    "harness-missing-command": /harness\.commands\[0\]\.command/i,
    "invalid-validation-mode": /architecture\.validation/i,
    "architecture-preset-type-mismatch": /architecture\.preset.*must match architecture\.type/i,
  };

  for (const { name, manifest } of invalidFixtures) {
    await t.test(`invalid fixture fails as expected: ${name}`, () => {
      const pattern = expectations[name] || /Manifest validation failed|Manifest v1 detected/;
      assert.throws(
        () => parseManifest(manifest),
        pattern,
        `Fixture "${name}" was expected to fail matching ${pattern}`
      );
    });
  }
});

test("manifest v2 contract tests: v1 manifest detection and rejection (#28, #14)", async () => {
  const v1 = await getFixture("invalid", "v1-flat-config");
  assert.equal(isV1Manifest(v1), true, "isV1Manifest should identify flat v1 config");
  assert.throws(
    () => parseManifest(v1),
    /Manifest v1 detected \(flat config\)\. create-lumen v2 uses a nested manifest \(manifestVersion: 2\)\./
  );
});

test("manifest v2 M1.1: valid fixtures with harness expose harness.commands", async (t) => {
  const harnessFull = await getFixture("valid", "harness-full");
  await t.test("harness-full parses with 5 commands", () => {
    const parsed = parseManifest(harnessFull);
    assert.ok(Array.isArray(parsed.harness.commands));
    assert.equal(parsed.harness.commands.length, 5);
    for (const cmd of parsed.harness.commands) {
      assert.ok(cmd.name);
      assert.ok(cmd.command);
    }
  });

  for (const name of ["validation-relaxed", "validation-none"]) {
    await t.test(`validation mode preserved: ${name}`, async () => {
      const manifest = await getFixture("valid", name);
      const parsed = parseManifest(manifest);
      const expected = name === "validation-relaxed" ? "relaxed" : "none";
      assert.equal(parsed.architecture.validation, expected);
      assert.equal(parsed.architecture.preset, "feature-based");
      assert.equal(parsed.architecture.type, "feature-based");
    });
  }
});

test("manifest v2 M1.1: new invalid fixtures fail with expected patterns", async (t) => {
  const cases = {
    "harness-empty-commands": /harness\.commands/i,
    "harness-missing-command": /harness\.commands\[0\]\.command/i,
    "invalid-validation-mode": /architecture\.validation/i,
    "architecture-preset-type-mismatch": /architecture\.preset.*must match architecture\.type/i,
  };
  for (const [name, pattern] of Object.entries(cases)) {
    await t.test(`invalid fixture fails as expected: ${name}`, async () => {
      const manifest = await getFixture("invalid", name);
      assert.throws(() => parseManifest(manifest), pattern);
    });
  }
});

test("manifest v2: parses database config with supabase provider for Next.js", () => {
  const manifest = {
    manifestVersion: 2,
    framework: { name: "next", variant: "app-router" },
    styling: { engine: "tailwind" },
    architecture: { type: "feature-based" },
    ui: { kit: "none" },
    docs: { language: "en" },
    paths: {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/app",
      ui: "src/components/ui",
    },
    tooling: { language: "ts", linter: "eslint", formatter: "prettier" },
    database: { orm: "prisma", provider: "supabase" },
  };

  const parsed = parseManifest(manifest);
  assert.equal(parsed.database.orm, "prisma");
  assert.equal(parsed.database.provider, "supabase");
});
