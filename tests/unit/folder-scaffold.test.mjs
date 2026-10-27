import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "fs";
import path from "path";
import os from "os";
import { confirmEmptyFolder } from "../../src/confirm-empty-folder.js";
import { resolveTargetFolder } from "../../src/main.js";
import { scaffoldBase } from "../../src/scaffold.js";
import { getProvider } from "../../src/engine/providers/base-provider.js";
import { injectArchitecture, injectConditionals } from "../../src/injector.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";

const TEMPLATES_DIR = path.resolve(import.meta.dirname, "../../templates");

test("folder-scaffold: confirmEmptyFolder returns target path on empty folder (#71)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-empty-"));
  try {
    const res = await confirmEmptyFolder(dir);
    assert.equal(res, dir);

    const relativeRes = await confirmEmptyFolder(".", dir);
    assert.equal(relativeRes, dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("folder-scaffold: resolveTargetFolder scaffolds directly into cwd when projectName is dot '.' (#71)", async () => {
  const baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-test-dot-"));
  const targetDir = path.join(baseDir, "my-fresh-project");
  await fsp.mkdir(targetDir, { recursive: true });

  try {
    const resolved = await resolveTargetFolder({
      cwd: targetDir,
      nameArg: ".",
      isNonInteractive: true,
    });

    assert.equal(resolved.isTargetCurrentDir, true);
    assert.equal(resolved.projectPath, targetDir);
    assert.equal(resolved.projectName, "my-fresh-project");
    assert.notEqual(resolved.projectPath, path.join(targetDir, "my-fresh-project"));
  } finally {
    await fsp.rm(baseDir, { recursive: true, force: true });
  }
});

test("folder-scaffold: resolveTargetFolder avoids redundant nesting when cwd matches projectName and is empty (#71)", async () => {
  const baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-test-bidhub-"));
  const bidhubDir = path.join(baseDir, "bidhub");
  await fsp.mkdir(bidhubDir, { recursive: true });

  try {
    const resolved = await resolveTargetFolder({
      cwd: bidhubDir,
      nameArg: "bidhub",
      isNonInteractive: true,
    });

    assert.equal(resolved.isTargetCurrentDir, true);
    assert.equal(resolved.projectPath, bidhubDir);
    assert.equal(resolved.projectName, "bidhub");
    assert.notEqual(resolved.projectPath, path.join(bidhubDir, "bidhub"));
  } finally {
    await fsp.rm(baseDir, { recursive: true, force: true });
  }
});

test("folder-scaffold: resolveTargetFolder creates subfolder when cwd is NOT empty and does not match dot (#71)", async () => {
  const baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-test-nonempty-"));
  const bidhubDir = path.join(baseDir, "bidhub");
  await fsp.mkdir(bidhubDir, { recursive: true });
  // Add a file to make it non-empty
  await fsp.writeFile(path.join(bidhubDir, "existing-file.txt"), "hello", "utf8");

  try {
    const resolved = await resolveTargetFolder({
      cwd: bidhubDir,
      nameArg: "bidhub",
      isNonInteractive: true,
    });

    assert.equal(resolved.isTargetCurrentDir, false);
    assert.equal(resolved.projectPath, path.join(bidhubDir, "bidhub"));
    assert.equal(resolved.projectName, "bidhub");
  } finally {
    await fsp.rm(baseDir, { recursive: true, force: true });
  }
});

test("folder-scaffold: Next.js scaffold in root folder with dot '.' does not create nested subfolder (#71)", async () => {
  const baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-root-"));
  const targetDir = path.join(baseDir, "next-clean-root");
  await fsp.mkdir(targetDir, { recursive: true });

  try {
    const resolved = await resolveTargetFolder({
      cwd: targetDir,
      nameArg: ".",
      isNonInteractive: true,
    });

    const responses = {
      projectName: resolved.projectName,
      framework: { name: "next", variant: "app-router" },
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      cssFramework: "tailwind",
      testing: "vitest",
      bundler: "turbopack",
      adapter: "none",
      linter: "eslint",
      formatter: "prettier",
    };

    const provider = getProvider("next", "app-router");
    await scaffoldBase(resolved.projectPath, provider, "ts", TEMPLATES_DIR);
    await injectArchitecture(resolved.projectPath, TEMPLATES_DIR, responses.architecture, responses.language, responses.cssFramework, responses.framework);
    await injectConditionals(resolved.projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
    await configureProject(resolved.projectPath, responses, responses.cssFramework, responses.framework);
    await cleanupBoilerplate(resolved.projectPath, responses);

    // Root targetDir must have package.json
    assert.ok(
      await fsp.stat(path.join(targetDir, "package.json")).catch(() => false),
      "package.json must be in targetDir"
    );

    // Nested next-clean-root must NOT exist
    assert.equal(
      await fsp.stat(path.join(targetDir, "next-clean-root")).catch(() => false),
      false,
      "nested folder targetDir/next-clean-root must NOT exist"
    );
  } finally {
    await fsp.rm(baseDir, { recursive: true, force: true });
  }
});
