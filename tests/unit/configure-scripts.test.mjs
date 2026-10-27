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

test("configure: writes components.json alias mappings to tsconfig.json and tsconfig.app.json (#72)", async () => {
  const dir = scaffoldPkg({});
  await configureProject(dir, {
    language: "ts",
    cssFramework: "tailwind",
    architecture: "feature-based",
    framework: { name: "react", variant: "vite" },
  });

  const tsconfigApp = JSON.parse(readFileSync(path.join(dir, "tsconfig.app.json"), "utf8"));
  assert.ok(tsconfigApp.compilerOptions?.paths?.["@/*"]);
  assert.deepEqual(tsconfigApp.compilerOptions?.paths?.["@/components/*"], ["./src/shared/components/*"]);
  assert.deepEqual(tsconfigApp.compilerOptions?.paths?.["@/ui/*"], ["./src/shared/components/ui/*"]);

  const rootTsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  assert.deepEqual(rootTsconfig.compilerOptions?.paths?.["@/components/*"], ["./src/shared/components/*"]);
  assert.deepEqual(rootTsconfig.compilerOptions?.paths?.["@/ui/*"], ["./src/shared/components/ui/*"]);
});

test("configure: Next.js merges path aliases into tsconfig.json matching architecture (#72)", async () => {
  const dir = scaffoldPkg({ dev: "next dev --turbopack", build: "next build", start: "next start" });
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"],
        },
      },
    })
  );

  await configureProject(dir, {
    language: "ts",
    cssFramework: "tailwind",
    architecture: "feature-based",
    framework: { name: "next", variant: "app-router" },
  });

  const tsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"));
  assert.deepEqual(tsconfig.compilerOptions?.paths?.["@/components/*"], ["./src/shared/components/*"]);
  assert.deepEqual(tsconfig.compilerOptions?.paths?.["@/ui/*"], ["./src/shared/components/ui/*"]);
  assert.deepEqual(tsconfig.compilerOptions?.paths?.["@/lib/*"], ["./src/lib/*"]);
});
