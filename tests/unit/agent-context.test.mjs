import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildManifest } from "../../src/manifest/emit.js";
import { buildAgentContext, emitAgentContext, renderAgentsMd } from "../../src/agent-context.js";

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
  agentDocs: true,
};

test("renderAgentsMd: reflects SSOT, preset, validation, component taxonomy, and harness", () => {
  const manifest = buildManifest(baseResponses);
  const md = renderAgentsMd(manifest);

  assert.ok(md.startsWith("# AGENTS.md"), "must start with AGENTS.md heading");
  assert.ok(md.includes("Single Source of Truth (SSOT)"), "must reference SSOT");
  assert.ok(md.includes("`lumen.config.json`"), "must reference lumen.config.json");
  assert.ok(md.includes("paths.*"), "must reference paths.*");
  assert.ok(md.includes("`feature-based`"), "must specify architecture preset");
  assert.ok(md.includes("`strict`"), "must specify validation mode");
  assert.ok(md.includes("`index.ts`"), "must specify barrel file");
  assert.ok(md.includes("@/shared"), "must reference @/shared");
  assert.ok(md.includes("Component Taxonomy"), "must include component taxonomy section");
  assert.ok(md.includes("Atomic UI Primitives"), "must document atomic UI primitives");
  assert.ok(md.includes("Compound Components"), "must document compound components");
  assert.ok(md.includes("Feature Components"), "must document feature components");
  assert.ok(md.includes("Validation Harness"), "must include validation harness");
  assert.ok(md.includes("harness.commands"), "must reference harness.commands");
  assert.ok(md.endsWith("\n"), "must end with a newline");
});

test("renderAgentsMd: Next.js includes official warning notice and component rules", () => {
  const nextResponses = {
    ...baseResponses,
    frameworkName: "next",
    frameworkVariant: "app-router",
    bundler: "turbopack",
    adapter: "none",
    architecture: "feature-based",
  };
  const manifest = buildManifest(nextResponses);
  const md = renderAgentsMd(manifest);

  const expectedWarning =
    `<!-- BEGIN:nextjs-agent-rules -->\n` +
    `## This is NOT the Next.js you know\n` +
    `This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ (resolved from this file's directory...) before writing any code. Heed deprecation notices.\n` +
    `<!-- END:nextjs-agent-rules -->`;

  assert.ok(md.includes(expectedWarning), "must include official Next.js agent warning verbatim");
  assert.ok(md.includes('"use client"'), "must include 'use client' rule");
  assert.ok(md.includes("React Server Components (RSC)"), "must document RSC");
});

test("buildAgentContext: backwards compatible helper", () => {
  const manifest = buildManifest(baseResponses);
  const ctx = buildAgentContext(manifest);
  assert.ok(ctx.agentsMd);
  assert.equal(ctx.agentsMd, ctx.conventionsMd);
});

test("emitAgentContext: writes AGENTS.md at root without .lumen/ and is byte-deterministic", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-agent-ctx-"));
  const outFile = await emitAgentContext(dir, baseResponses);

  assert.equal(outFile, path.join(dir, "AGENTS.md"));

  const stat = await fsp.stat(outFile);
  assert.ok(stat.isFile(), "AGENTS.md must exist at root");

  // .lumen directory must NOT exist
  let lumenDirExists = false;
  try {
    await fsp.access(path.join(dir, ".lumen"));
    lumenDirExists = true;
  } catch {
    lumenDirExists = false;
  }
  assert.equal(lumenDirExists, false, ".lumen/ directory must not exist");

  const first = await fsp.readFile(outFile, "utf8");
  assert.ok(first.endsWith("\n"), "AGENTS.md must end with newline");
  assert.ok(first.includes("Single Source of Truth (SSOT)"));

  // Double emission = byte-identical
  await emitAgentContext(dir, baseResponses);
  const second = await fsp.readFile(outFile, "utf8");
  assert.equal(second, first, "AGENTS.md must be byte-identical on re-emit");
});

test("emitAgentContext: accepts a validated manifest directly", async () => {
  const manifest = buildManifest(baseResponses);
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-agent-ctx-manifest-"));
  const outPath = await emitAgentContext(dir, manifest);
  assert.equal(outPath, path.join(dir, "AGENTS.md"));

  const content = await fsp.readFile(outPath, "utf8");
  assert.ok(content.includes("harness.commands"));

  // Same bytes as emitting from responses
  const dir2 = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-agent-ctx-resp-"));
  await emitAgentContext(dir2, baseResponses);
  const content2 = await fsp.readFile(path.join(dir2, "AGENTS.md"), "utf8");
  assert.equal(content, content2, "AGENTS.md must match between manifest and responses input");
});
