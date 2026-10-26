import test from "node:test";
import assert from "node:assert/strict";
import { computeDeps } from "../../src/dependencies.js";

// Baseline cell: nothing selected ÔÇö only react/react-dom are always present.
const BASE = {
  cssFramework: "none",
  stateManagement: "none",
  router: false,
  iconLibrary: "none",
  apiClient: "none",
  testing: "none",
  linter: "none",
  formatter: "none",
  language: "ts",
};

function cellDeps(cell) {
  const { deps, devDeps, devDepBatches } = computeDeps({ ...BASE, ...cell });
  return { deps, devDeps, devDepBatches };
}

function has(list, ...pkgs) {
  for (const p of pkgs) assert.ok(list.includes(p), `${p} missing from ${JSON.stringify(list)}`);
}

function lacks(list, ...pkgs) {
  for (const p of pkgs) assert.ok(!list.includes(p), `${p} unexpectedly present in ${JSON.stringify(list)}`);
}

test("baseline scaffolds react + react-dom only", () => {
  const { deps, devDeps } = cellDeps({});
  assert.equal(deps.length, 2);
  assert.deepEqual(deps.sort(), ["react", "react-dom"]);
  assert.equal(devDeps.length, 0);
});

test("tailwind: tailwindcss/@tailwindcss/vite as devDeps, clsx + tailwind-merge as deps", () => {
  const { deps, devDeps } = cellDeps({ cssFramework: "tailwind" });
  has(devDeps, "tailwindcss", "@tailwindcss/vite");
  has(deps, "clsx", "tailwind-merge");
});

test("tailwind next.js: tailwindcss/@tailwindcss/postcss as devDeps", () => {
  const { deps, devDeps } = cellDeps({ cssFramework: "tailwind", framework: "next" });
  has(devDeps, "tailwindcss", "@tailwindcss/postcss", "postcss");
  lacks(devDeps, "@tailwindcss/vite");
  has(deps, "clsx", "tailwind-merge");
});

test("bootstrap removed post-#51: no bootstrap deps for legacy bootstrap cell", () => {
  const { deps, devDeps } = cellDeps({ cssFramework: "bootstrap" });
  lacks(deps, "bootstrap", "react-bootstrap");
  lacks(deps, "tailwindcss", "@tailwindcss/vite");
  lacks(devDeps, "tailwindcss");
});

test("redux vs zustand vs none are mutually exclusive", () => {
  const redux = cellDeps({ stateManagement: "redux" });
  has(redux.deps, "@reduxjs/toolkit", "react-redux");
  const zustand = cellDeps({ stateManagement: "zustand" });
  has(zustand.deps, "zustand");
  lacks(zustand.deps, "@reduxjs/toolkit", "react-redux");
  const none = cellDeps({ stateManagement: "none" });
  lacks(none.deps, "zustand", "@reduxjs/toolkit", "react-redux");
});

test("router adds react-router-dom", () => {
  const { deps } = cellDeps({ router: true });
  has(deps, "react-router-dom");
});

test("icons: lucide vs huge", () => {
  const lucide = cellDeps({ iconLibrary: "lucide" });
  has(lucide.deps, "lucide-react");
  lacks(lucide.deps, "@hugeicons/react");
  const huge = cellDeps({ iconLibrary: "huge" });
  has(huge.deps, "@hugeicons/react", "@hugeicons/core-free-icons");
});

test("api client: axios only", () => {
  const { deps } = cellDeps({ apiClient: "axios" });
  has(deps, "axios");
});

test("vitest installs the vitest runtime + jsdom test stack", () => {
  const { devDeps } = cellDeps({ testing: "vitest" });
  has(devDeps, "vitest", "@testing-library/react", "@testing-library/jest-dom", "jsdom");
  lacks(devDeps, "jest", "jest-environment-jsdom", "babel-jest");
});

test("jest installs jest-environment-jsdom + babel presets", () => {
  const { devDeps } = cellDeps({ testing: "jest" });
  has(devDeps, "jest", "jest-environment-jsdom", "@testing-library/react", "@testing-library/jest-dom", "jsdom", "babel-jest", "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript");
  lacks(devDeps, "vitest");
});

test("jest next.js (TS): installs next/jest dependencies without babel presets", () => {
  const { devDeps } = cellDeps({ testing: "jest", framework: "next", language: "ts" });
  has(devDeps, "jest", "jest-environment-jsdom", "@testing-library/react", "@testing-library/jest-dom", "@types/jest");
  lacks(devDeps, "babel-jest", "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript", "jsdom", "vitest");
});

test("jest next.js (JS): installs next/jest dependencies without @types/jest or babel presets", () => {
  const { devDeps } = cellDeps({ testing: "jest", framework: "next", language: "js" });
  has(devDeps, "jest", "jest-environment-jsdom", "@testing-library/react", "@testing-library/jest-dom");
  lacks(devDeps, "@types/jest", "babel-jest", "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript", "jsdom", "vitest");
});

test("eslint + ts declares jiti and typescript-eslint (ESLint >= 10 TS config loader)", () => {
  const { devDeps } = cellDeps({ linter: "eslint", language: "ts" });
  has(devDeps, "eslint", "@eslint/js", "eslint-plugin-react-hooks", "eslint-plugin-react-refresh", "globals", "jiti", "typescript-eslint");
});

test("eslint + js never declares jiti / typescript-eslint", () => {
  const { devDeps } = cellDeps({ linter: "eslint", language: "js" });
  has(devDeps, "eslint");
  lacks(devDeps, "jiti", "typescript-eslint");
});

test("oxlint installs oxlint only", () => {
  const { devDeps } = cellDeps({ linter: "oxlint" });
  has(devDeps, "oxlint");
  lacks(devDeps, "eslint", "@eslint/js", "jiti");
});

test("prettier + eslint wires eslint-config-prettier", () => {
  const { devDeps } = cellDeps({ linter: "eslint", formatter: "prettier" });
  has(devDeps, "prettier", "eslint-config-prettier");
});

test("prettier + oxlint does not wire eslint-config-prettier", () => {
  const { devDeps } = cellDeps({ linter: "oxlint", formatter: "prettier" });
  has(devDeps, "prettier");
  lacks(devDeps, "eslint-config-prettier");
});

test("oxfmt installs oxfmt", () => {
  const { devDeps } = cellDeps({ linter: "oxlint", formatter: "oxfmt" });
  has(devDeps, "oxfmt");
});

test("eslint + oxfmt installs oxfmt and does not wire eslint-config-prettier", () => {
  const { devDeps } = cellDeps({ linter: "eslint", formatter: "oxfmt" });
  has(devDeps, "eslint", "oxfmt");
  lacks(devDeps, "eslint-config-prettier", "prettier");
});

test("eslint next.js declares eslint-config-next and no react-refresh or jiti", () => {
  const { devDeps } = cellDeps({ linter: "eslint", framework: "next", language: "ts" });
  has(devDeps, "eslint", "eslint-config-next");
  lacks(devDeps, "eslint-plugin-react-refresh", "typescript-eslint", "jiti", "@eslint/js");
});

test("eslint + prettier next.js wires eslint-config-prettier and eslint-config-next", () => {
  const { devDeps } = cellDeps({ linter: "eslint", formatter: "prettier", framework: "next" });
  has(devDeps, "eslint", "eslint-config-next", "prettier", "eslint-config-prettier");
});

test("no formatter = no format deps", () => {
  const { devDeps } = cellDeps({ linter: "eslint", formatter: "none" });
  lacks(devDeps, "prettier", "oxfmt", "eslint-config-prettier");
});

test("computeDeps returns properly grouped category batches (devDepBatches)", () => {
  // All 4 categories active: css, testing, linter, formatter
  const full = cellDeps({
    cssFramework: "tailwind",
    testing: "vitest",
    linter: "oxlint",
    formatter: "oxfmt",
  });
  assert.equal(full.devDepBatches.length, 4);
  assert.deepEqual(full.devDepBatches[0], ["tailwindcss", "@tailwindcss/vite"]);
  assert.deepEqual(full.devDepBatches[1], ["vitest", "@testing-library/react", "@testing-library/jest-dom", "jsdom"]);
  assert.deepEqual(full.devDepBatches[2], ["oxlint"]);
  assert.deepEqual(full.devDepBatches[3], ["oxfmt"]);

  // Subset of categories: next.js tailwind + eslint + prettier (css, linter, formatter)
  const nextStack = cellDeps({
    cssFramework: "tailwind",
    framework: "next",
    linter: "eslint",
    formatter: "prettier",
  });
  assert.equal(nextStack.devDepBatches.length, 3);
  assert.deepEqual(nextStack.devDepBatches[0], ["tailwindcss", "@tailwindcss/postcss", "postcss"]);
  assert.deepEqual(nextStack.devDepBatches[1], ["eslint", "eslint-config-next"]);
  assert.deepEqual(nextStack.devDepBatches[2], ["prettier", "eslint-config-prettier"]);

  // Bug #57 reproduction cell: peer-heavy devDeps without css (testing, linter, formatter)
  const bug57 = cellDeps({
    testing: "vitest",
    linter: "oxlint",
    formatter: "oxfmt",
  });
  assert.equal(bug57.devDepBatches.length, 3);
  assert.deepEqual(bug57.devDepBatches[0], ["vitest", "@testing-library/react", "@testing-library/jest-dom", "jsdom"]);
  assert.deepEqual(bug57.devDepBatches[1], ["oxlint"]);
  assert.deepEqual(bug57.devDepBatches[2], ["oxfmt"]);

  // Baseline has no dev dependencies, so devDepBatches is empty
  const empty = cellDeps({});
  assert.equal(empty.devDepBatches.length, 0);
  assert.deepEqual(empty.devDepBatches, []);

  // Legacy bootstrap cell yields no styling deps post-#51
  const legacyBootstrap = cellDeps({ cssFramework: "bootstrap" });
  assert.equal(legacyBootstrap.devDepBatches.length, 0);
  assert.deepEqual(legacyBootstrap.devDepBatches, []);
});

test("snapshot comparison before/after batching: flattened devDepBatches exactly matches devDeps", () => {
  const matrixSample = [
    {},
    { cssFramework: "tailwind" },
    { cssFramework: "tailwind", framework: "next" },
    { cssFramework: "none" },
    { testing: "vitest" },
    { testing: "jest" },
    { linter: "eslint", language: "ts" },
    { linter: "eslint", language: "js" },
    { linter: "oxlint" },
    { linter: "eslint", formatter: "prettier" },
    { linter: "oxlint", formatter: "prettier" },
    { linter: "oxlint", formatter: "oxfmt" },
    { linter: "eslint", formatter: "oxfmt" },
    { linter: "eslint", framework: "next", language: "ts" },
    { linter: "eslint", formatter: "prettier", framework: "next" },
    { cssFramework: "tailwind", testing: "vitest", linter: "oxlint", formatter: "oxfmt" },
    { cssFramework: "tailwind", testing: "jest", linter: "eslint", language: "ts", formatter: "prettier" },
    { cssFramework: "bootstrap", testing: "jest", linter: "eslint", language: "ts", formatter: "prettier" },
    { cssFramework: "none", testing: "vitest", linter: "oxlint", formatter: "oxfmt" },
  ];

  for (const cell of matrixSample) {
    const { devDeps, devDepBatches } = cellDeps(cell);
    // Flattened batches must exactly match backward-compatible devDeps
    assert.deepEqual(
      devDepBatches.flat(),
      devDeps,
      `devDepBatches.flat() did not match devDeps for cell: ${JSON.stringify(cell)}`
    );
    // Every batch in devDepBatches must be a non-empty array
    for (const batch of devDepBatches) {
      assert.ok(Array.isArray(batch), "each batch must be an array");
      assert.ok(batch.length > 0, "batches must not contain empty category arrays");
    }
  }
});
