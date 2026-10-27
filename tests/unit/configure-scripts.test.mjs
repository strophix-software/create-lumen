import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configureProject } from "../../src/configure.js";

function scaffoldPkg(scripts) {
  const dir = mkdtempSync(path.join(tmpdir(), "lumen-configure-"));
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "probe", scripts }),
  );
  return dir;
}

function scriptsOf(dir) {
  return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).scripts;
}

test("configure: preserves base/overlay scripts, only fills gaps", async () => {
  const dir = scaffoldPkg({ dev: "next dev --turbopack", build: "next build" });
  await configureProject(dir, "ts", "tailwind");
  const scripts = scriptsOf(dir);
  assert.equal(scripts.dev, "next dev --turbopack");
  assert.equal(scripts.build, "next build");
  assert.equal(scripts.typecheck, "tsc -b");
});

test("configure: fills vite defaults when scripts are absent", async () => {
  const dir = scaffoldPkg({});
  await configureProject(dir, "ts", "tailwind");
  const scripts = scriptsOf(dir);
  assert.equal(scripts.dev, "vite");
  assert.equal(scripts.build, "vite build");
  assert.equal(scripts.preview, "vite preview");
  assert.equal(scripts.typecheck, "tsc -b");
});

test("configure: Next.js does not inject vite preview or vite scripts into package.json", async () => {
  const dir = scaffoldPkg({ dev: "next dev --turbopack", build: "next build", start: "next start" });
  await configureProject(dir, "ts", "tailwind", "next");
  const scripts = scriptsOf(dir);
  assert.equal(scripts.dev, "next dev --turbopack");
  assert.equal(scripts.build, "next build");
  assert.equal(scripts.start, "next start");
  assert.equal(scripts.preview, undefined);
  assert.equal(scripts.typecheck, "tsc -b");
});
