import test from "node:test";
import assert from "node:assert/strict";
import { resolvePaths } from "../../src/manifest/paths.js";

test("resolvePaths: feature-based react/vite -> canonical shared paths", () => {
  const p = resolvePaths({ architecture: "feature-based", framework: { name: "react", variant: "vite" } });
  assert.deepEqual(p, {
    features: "src/features",
    components: "src/shared/components",
    services: "src/shared/services",
    hooks: "src/shared/hooks",
    pages: "src/app/router",
    ui: "src/shared/components/ui",
  });
});

test("resolvePaths: type-based react/vite", () => {
  const p = resolvePaths({ architecture: "type-based", framework: { name: "react", variant: "vite" } });
  assert.deepEqual(p, {
    features: "src/features",
    components: "src/components",
    services: "src/services",
    hooks: "src/hooks",
    pages: "src/pages",
    ui: "src/ui",
  });
});

test("resolvePaths: component-based react/vite (backward compat fallback)", () => {
  const p = resolvePaths({ architecture: "component-based", framework: { name: "react", variant: "vite" } });
  assert.deepEqual(p, {
    features: "src/features",
    components: "src/components",
    services: "src/services",
    hooks: "src/hooks",
    pages: "src/pages",
    ui: "src/ui",
  });
});

test("resolvePaths: feature-based next app-router -> app at src/app", () => {
  const p = resolvePaths({ architecture: "feature-based", framework: { name: "next", variant: "app-router" } });
  assert.equal(p.pages, "src/app");
  assert.equal(p.features, "src/features");
  assert.equal(p.ui, "src/shared/components/ui");
});

test("resolvePaths: feature-based next pages-router -> pages at src/pages", () => {
  const p = resolvePaths({ architecture: "feature-based", framework: { name: "next", variant: "pages-router" } });
  assert.equal(p.pages, "src/pages");
});

test("resolvePaths: none react", () => {
  const p = resolvePaths({ architecture: "none", framework: { name: "react", variant: "vite" } });
  assert.deepEqual(p, {
    features: "src",
    components: "src/components",
    services: "src/services",
    hooks: "src/hooks",
    pages: "src/pages",
    ui: "src/components/ui",
  });
});

test("resolvePaths: none next pages-router -> pages at src/pages", () => {
  const p = resolvePaths({ architecture: "none", framework: { name: "next", variant: "pages-router" } });
  assert.equal(p.pages, "src/pages");
  assert.equal(p.features, "src");
});

test("resolvePaths: lumen-cli can resolve every target from manifest alone (keys present)", () => {
  for (const arch of ["feature-based", "type-based", "component-based", "none"]) {
    for (const fw of [{ name: "react", variant: "vite" }, { name: "next", variant: "app-router" }, { name: "next", variant: "pages-router" }]) {
      const p = resolvePaths({ architecture: arch, framework: fw });
      for (const k of ["features", "components", "services", "hooks", "pages", "ui"]) {
        assert.ok(typeof p[k] === "string" && p[k].length > 0, `missing ${k} for ${arch} ${fw.name}/${fw.variant}`);
      }
    }
  }
});
