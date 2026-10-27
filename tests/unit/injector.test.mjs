import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { injectFormatter, injectLinter, injectUiKit, getComponentsJson } from "../../src/injector.js";
import { resolveProjectName } from "../../src/main.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

const JS_ESLINT = `import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules },
  },
];
`;

const TS_ESLINT = `import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules },
  }
);
`;

async function makeProject({ eslintConfig, ext }) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-unit-"));
  if (eslintConfig !== null) {
    await fsp.writeFile(path.join(dir, `eslint.config.${ext}`), eslintConfig);
  }
  await fsp.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "x", scripts: {} }, null, 2)
  );
  return dir;
}

async function read(dir, file) {
  return fsp.readFile(path.join(dir, file), "utf8");
}

test("eslint + prettier (JS) injects config, scripts, and wires prettier last (array form)", async () => {
  const dir = await makeProject({ eslintConfig: JS_ESLINT, ext: "js" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "prettier", linter: "eslint", language: "js" });

  assert.ok(await fsp.stat(path.join(dir, ".prettierrc")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, "prettier --write .");
  assert.equal(pkg.scripts["format:check"], "prettier --check .");

  const cfg = await read(dir, "eslint.config.js");
  assert.ok(cfg.includes('import prettier from "eslint-config-prettier";'));
  assert.ok(/prettier,\s*\n\s*[)\]];/.test(cfg), "prettier not last");
});

test("eslint + prettier (TS) injects prettier last (tseslint.config form)", async () => {
  const dir = await makeProject({ eslintConfig: TS_ESLINT, ext: "ts" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "prettier", linter: "eslint", language: "ts" });

  const cfg = await read(dir, "eslint.config.ts");
  assert.ok(cfg.includes('import prettier from "eslint-config-prettier";'));
  assert.ok(/prettier,\s*\n\s*[)\]];/.test(cfg), "prettier not last in tseslint.config");
});

test("oxlint + oxfmt injects .oxfmtrc.json and oxfmt script, leaves eslint config untouched", async () => {
  const dir = await makeProject({ eslintConfig: TS_ESLINT, ext: "ts" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "oxfmt", linter: "oxlint", language: "ts" });

  assert.ok(await fsp.stat(path.join(dir, ".oxfmtrc.json")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, "oxfmt .");
  const cfg = await read(dir, "eslint.config.ts");
  assert.ok(!cfg.includes("eslint-config-prettier"));
});

test("oxlint + prettier injects .prettierrc but never wires eslint-config-prettier", async () => {
  const dir = await makeProject({ eslintConfig: TS_ESLINT, ext: "ts" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "prettier", linter: "oxlint", language: "ts" });

  assert.ok(await fsp.stat(path.join(dir, ".prettierrc")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, "prettier --write .");
  const cfg = await read(dir, "eslint.config.ts");
  assert.ok(!cfg.includes("eslint-config-prettier"));
});

test("none formatter is a no-op", async () => {
  const dir = await makeProject({ eslintConfig: JS_ESLINT, ext: "js" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "none", linter: "eslint", language: "js" });

  await assert.rejects(() => fsp.stat(path.join(dir, ".prettierrc")));
  await assert.rejects(() => fsp.stat(path.join(dir, ".oxfmtrc.json")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, undefined);
});

test("eslint + prettier is idempotent (re-run adds exactly one import and one prettier)", async () => {
  const dir = await makeProject({ eslintConfig: JS_ESLINT, ext: "js" });
  const responses = { formatter: "prettier", linter: "eslint", language: "js" };
  await injectFormatter(dir, TEMPLATES_DIR, responses);
  await injectFormatter(dir, TEMPLATES_DIR, responses);

  const cfg = await read(dir, "eslint.config.js");
  assert.equal((cfg.match(/eslint-config-prettier/g) || []).length, 1);
  assert.equal((cfg.match(/prettier,\n/g) || []).length, 1);
});

test("eslint + oxfmt injects .oxfmtrc.json and oxfmt script, leaves eslint config untouched", async () => {
  const dir = await makeProject({ eslintConfig: TS_ESLINT, ext: "ts" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "oxfmt", linter: "eslint", language: "ts" });

  assert.ok(await fsp.stat(path.join(dir, ".oxfmtrc.json")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, "oxfmt .");
  assert.equal(pkg.scripts["format:check"], "oxfmt --check .");
  const cfg = await read(dir, "eslint.config.ts");
  assert.ok(!cfg.includes("eslint-config-prettier"));
});

test("oxfmt + oxlint is idempotent across multiple injection passes", async () => {
  const dir = await makeProject({ eslintConfig: null, ext: "js" });
  const responses = { formatter: "oxfmt", linter: "oxlint", language: "js" };
  await injectFormatter(dir, TEMPLATES_DIR, responses);
  await injectFormatter(dir, TEMPLATES_DIR, responses);

  assert.ok(await fsp.stat(path.join(dir, ".oxfmtrc.json")));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.format, "oxfmt .");
  assert.equal(pkg.scripts["format:check"], "oxfmt --check .");
});

test("injectLinter (Next.js) injects eslint.config.mjs and lint scripts", async () => {
  const dir = await makeProject({ eslintConfig: null, ext: "js" });
  await injectLinter(dir, TEMPLATES_DIR, "eslint", "ts", "next");

  assert.ok(await fsp.stat(path.join(dir, "eslint.config.mjs")));
  const cfg = await read(dir, "eslint.config.mjs");
  assert.ok(cfg.includes("eslint-config-next"));
  const pkg = JSON.parse(await read(dir, "package.json"));
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts["lint:fix"], "eslint . --fix");
});

test("eslint + prettier (Next.js) wires prettier into eslint.config.mjs", async () => {
  const NEXT_ESLINT = `import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat();
const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
`;
  const dir = await makeProject({ eslintConfig: NEXT_ESLINT, ext: "mjs" });
  await injectFormatter(dir, TEMPLATES_DIR, { formatter: "prettier", linter: "eslint", language: "ts", framework: "next" });

  const cfg = await read(dir, "eslint.config.mjs");
  assert.ok(cfg.includes('import prettier from "eslint-config-prettier";'));
  assert.ok(/prettier,\s*\n\s*[)\]];/.test(cfg), "prettier not wired into eslint.config.mjs");
});

test("quick setup falls back to the current folder name when no project name argument is passed", () => {
  assert.equal(resolveProjectName({ quickSetup: true, cwd: "/tmp/my-appus" }), "my-appus");
  assert.equal(resolveProjectName({ quickSetup: true, projectName: "custom-app", cwd: "/tmp/my-appus" }), "custom-app");
  assert.equal(resolveProjectName({ quickSetup: false, cwd: "/tmp/my-appus" }), null);
});

test("resolveProjectName ignores the quick-setup flag when it appears before the project name", () => {
  const originalArgv = process.argv;
  try {
    process.argv = ["node", "cli.js", "-y", "my-appu"];
    assert.equal(resolveProjectName({ quickSetup: true, cwd: "/tmp/my-appus" }), "my-appu");
  } finally {
    process.argv = originalArgv;
  }
});

test("injectUiKit: writes components.json, lib/utils cn helper, and Button/Card primitives (feature-based TS)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-shadcn-"));
  await fsp.mkdir(path.join(dir, "src"), { recursive: true });

  await injectUiKit(dir, TEMPLATES_DIR, { uiKit: "shadcn", cssFramework: "tailwind" }, "feature-based", "ts");

  // components.json
  const compJsonRaw = await fsp.readFile(path.join(dir, "components.json"), "utf8");
  const compJson = JSON.parse(compJsonRaw);
  assert.equal(compJson.style, "new-york");
  assert.equal(compJson.rsc, false);
  assert.equal(compJson.tsx, true);
  assert.equal(compJson.tailwind.css, "src/shared/styles/globals.css");
  assert.equal(compJson.aliases.utils, "@/lib/utils");
  assert.equal(compJson.aliases.ui, "@/shared/components/ui");

  // cn helper
  const utilsCode = await fsp.readFile(path.join(dir, "src", "lib", "utils.ts"), "utf8");
  assert.match(utilsCode, /twMerge\(clsx\(inputs\)\)/);

  // Primitives
  assert.ok(await fsp.stat(path.join(dir, "src", "shared", "components", "ui", "Button.tsx")));
  assert.ok(await fsp.stat(path.join(dir, "src", "shared", "components", "ui", "Card.tsx")));
  assert.ok(await fsp.stat(path.join(dir, "src", "shared", "components", "ui", "index.ts")));

  const buttonCode = await fsp.readFile(path.join(dir, "src", "shared", "components", "ui", "Button.tsx"), "utf8");
  assert.match(buttonCode, /buttonVariants/);
  assert.match(buttonCode, /@\/lib\/utils/);

  const cardCode = await fsp.readFile(path.join(dir, "src", "shared", "components", "ui", "Card.tsx"), "utf8");
  assert.match(cardCode, /CardHeader/);
  assert.match(cardCode, /@\/lib\/utils/);

  await fsp.rm(dir, { recursive: true, force: true });
});

test("injectUiKit: writes components.json and primitives for type-based JS", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-shadcn-js-"));
  await fsp.mkdir(path.join(dir, "src"), { recursive: true });

  await injectUiKit(dir, TEMPLATES_DIR, { uiKit: "shadcn", cssFramework: "tailwind" }, "type-based", "js");

  const compJson = JSON.parse(await fsp.readFile(path.join(dir, "components.json"), "utf8"));
  assert.equal(compJson.tsx, false);
  assert.equal(compJson.tailwind.css, "src/styles/globals.css");
  assert.equal(compJson.aliases.ui, "@/ui");

  assert.ok(await fsp.stat(path.join(dir, "src", "lib", "utils.js")));
  assert.ok(await fsp.stat(path.join(dir, "src", "ui", "Button.jsx")));
  assert.ok(await fsp.stat(path.join(dir, "src", "ui", "Card.jsx")));
  assert.ok(await fsp.stat(path.join(dir, "src", "ui", "index.js")));

  await fsp.rm(dir, { recursive: true, force: true });
});

test("injectUiKit: rejects shadcn when cssFramework is not tailwind", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-shadcn-err-"));
  await assert.rejects(
    () => injectUiKit(dir, TEMPLATES_DIR, { uiKit: "shadcn", cssFramework: "bootstrap" }, "feature-based", "ts"),
    /ui\.kit "shadcn" requires styling\.engine "tailwind"/
  );
  await fsp.rm(dir, { recursive: true, force: true });
});

test("getComponentsJson: returns Next App Router contract stub when framework is next", () => {
  const stub = getComponentsJson({ framework: "next", architecture: "feature-based", language: "ts" });
  assert.equal(stub.rsc, true);
  assert.equal(stub.tailwind.css, "src/app/globals.css");
  assert.equal(stub.aliases.components, "@/shared/components");
  assert.equal(stub.aliases.ui, "@/shared/components/ui");
});

