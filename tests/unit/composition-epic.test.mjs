import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  CAPABILITIES,
  FRAMEWORK_CAPABILITIES,
  getFrameworkDescriptor,
  hasCapability,
  isOptionCompatible,
  getCompatibleOptions,
  validateCompatibility,
} from "../../src/engine/capabilities.js";
import {
  BaseProvider,
  ViteReactProvider,
  getProvider,
  listProviders,
} from "../../src/engine/providers/base-provider.js";
import {
  injectArchitecture,
  injectConditionals,
  injectFormatter,
} from "../../src/injector.js";
import { copyEnvExample } from "../../src/env.js";
import { setupCssFramework } from "../../src/css.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";
import { generateReadme } from "../../src/readme.js";
import { getPkgManager } from "../../src/utils/pkg-manager.js";
import { emitManifest } from "../../src/manifest/emit.js";
import { parseManifest } from "../../src/manifest/schema.js";
import { runViteCreate } from "../../src/scaffold.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const TEMPLATES_DIR = path.join(REPO, "templates");
const CACHE = path.join(REPO, "tests", ".cache");
const pkg = getPkgManager();

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureBase(language) {
  const baseApp = path.join(CACHE, `base-${language}`, "app");
  if (await exists(baseApp)) return baseApp;
  const parent = path.join(CACHE, `base-${language}`);
  await fsp.rm(parent, { recursive: true, force: true });
  await fsp.mkdir(parent, { recursive: true });
  await runViteCreate(baseApp, "app", pkg, language);
  return baseApp;
}

async function generateProject(responses, baseApp, targetDir) {
  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.cp(baseApp, targetDir, { recursive: true });

  await injectArchitecture(
    targetDir,
    TEMPLATES_DIR,
    responses.architecture,
    responses.language,
    responses.cssFramework
  );
  await injectConditionals(
    targetDir,
    TEMPLATES_DIR,
    responses,
    responses.architecture,
    responses.language
  );
  await injectFormatter(targetDir, TEMPLATES_DIR, responses);
  await setupCssFramework({
    projectPath: targetDir,
    templatesDir: TEMPLATES_DIR,
    language: responses.language,
    cssFramework: responses.cssFramework,
    architecture: responses.architecture,
    ext: responses.language === "ts" ? "tsx" : "jsx",
    pkg,
  });
  await configureProject(targetDir, responses.language, responses.cssFramework);
  await cleanupBoilerplate(targetDir);
  await copyEnvExample(targetDir, TEMPLATES_DIR, responses);
  await emitManifest(targetDir, responses);
  if (responses.readme) {
    await generateReadme(targetDir, responses.projectName || "app", responses);
  }
  await emitManifest(targetDir, responses);
  process.chdir(REPO);
  return targetDir;
}

async function collectFilesRecursive(dir, baseDir = dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await collectFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort();
}

// ---------------------------------------------------------------------------
// Epic #10 / E1: Capabilities-based Composition Verification
// ---------------------------------------------------------------------------

test("Epic #10 / E1: Framework behavior is driven purely by BaseProvider and declared capabilities", () => {
  const framework = { name: "react", variant: "vite" };
  const provider = getProvider("react", "vite");

  // 1. BaseProvider seam encapsulation
  assert.ok(provider, "ViteReactProvider must be registered");
  assert.ok(provider instanceof BaseProvider, "Provider must inherit from BaseProvider");
  assert.ok(provider instanceof ViteReactProvider, "Provider must be ViteReactProvider");
  assert.equal(provider.name, "react");
  assert.equal(provider.variant, "vite");

  // 2. Pure declared capabilities (hasCapability)
  assert.equal(hasCapability(framework, CAPABILITIES.CLIENT_ROUTING), true);
  assert.equal(hasCapability(framework, CAPABILITIES.CLIENT_COMPONENTS), true);
  assert.equal(hasCapability(framework, CAPABILITIES.SPA_FALLBACK), true);
  assert.equal(hasCapability(framework, CAPABILITIES.AGENT_DOCS), true);

  // Incompatible capabilities must be strictly false (not supported by React/Vite)
  assert.equal(hasCapability(framework, CAPABILITIES.FILESYSTEM_ROUTING), false);
  assert.equal(hasCapability(framework, CAPABILITIES.SERVER_COMPONENTS), false);
  assert.equal(hasCapability(framework, CAPABILITIES.ROUTE_HANDLERS), false);
  assert.equal(hasCapability(framework, CAPABILITIES.API_ROUTES), false);
  assert.equal(hasCapability(framework, CAPABILITIES.ADAPTERS), false);
  assert.equal(hasCapability(framework, CAPABILITIES.BUNDLER_SELECTION), false);
  assert.equal(hasCapability(framework, CAPABILITIES.REACT_COMPILER), false);

  // Provider instance mirrors declared capabilities
  assert.equal(provider.hasCapability(CAPABILITIES.CLIENT_ROUTING), true);
  assert.equal(provider.hasCapability(CAPABILITIES.FILESYSTEM_ROUTING), false);

  // 3. Declarative option compatibility (getCompatibleOptions)
  const compatible = getCompatibleOptions(framework);
  assert.ok(compatible, "Compatible options descriptor must be returned");
  assert.deepStrictEqual(compatible.architectures, ["feature-based", "type-based", "none"]);
  assert.deepStrictEqual(compatible.styling, ["tailwind", "none"]);
  assert.deepStrictEqual(compatible.uiKits, ["shadcn", "none"]);
  assert.deepStrictEqual(compatible.languages, ["ts", "js"]);
  assert.deepStrictEqual(compatible.linters, ["eslint", "oxlint", "biome", "none"]);
  assert.deepStrictEqual(compatible.formatters, ["prettier", "oxfmt", "none"]);
  assert.deepStrictEqual(compatible.bundlers, [], "React/Vite does not expose bundler selection");
  assert.deepStrictEqual(compatible.adapters, [], "React/Vite does not expose server adapters");
  assert.equal(compatible.supportsRouterPrompt, true);

  // 4. File plan declaration
  assert.equal(provider.getFilePlan({ lang: "ts" }), "templates/bases/react/vite/ts");
  assert.equal(provider.getFilePlan({ lang: "js" }), "templates/bases/react/vite/js");

  // 5. Package set declaration
  const tsPkg = provider.getPackageSet({ options: { language: "ts" } });
  assert.equal(tsPkg.dependencies.react, "^19.0.0");
  assert.equal(tsPkg.dependencies["react-dom"], "^19.0.0");
  assert.equal(tsPkg.devDependencies.vite, "^6.0.0");
  assert.equal(tsPkg.devDependencies["@vitejs/plugin-react"], "^4.3.0");
  assert.equal(tsPkg.devDependencies.typescript, "^5.7.0");
  assert.equal(tsPkg.devDependencies["@types/react"], "^19.0.0");

  const jsPkg = provider.getPackageSet({ options: { language: "js" } });
  assert.equal(jsPkg.dependencies.react, "^19.0.0");
  assert.equal(jsPkg.devDependencies.typescript, undefined);

  // 6. Capability validation gate
  const valid = validateCompatibility(framework, {
    architecture: "feature-based",
    styling: "tailwind",
    language: "ts",
    linter: "eslint",
    formatter: "prettier",
  });
  assert.equal(valid.valid, true);

  const invalid = validateCompatibility(framework, {
    architecture: "hybrid", // invalid for react
    bundler: "turbopack",   // invalid for react
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 2);
});

test("Epic #10 / E1: Assert that framework = fragments + declaration (no ad-hoc if-framework branching)", async () => {
  // 1. Prove runtime scaffolder (src/scaffold.js) contains no framework branches
  const scaffoldSrc = await fsp.readFile(path.join(REPO, "src", "scaffold.js"), "utf8");
  assert.ok(!/if\s*\([^)]*framework/i.test(scaffoldSrc), "src/scaffold.js must not contain if-framework branches");
  assert.ok(!/framework\s*===/i.test(scaffoldSrc), "src/scaffold.js must not contain framework equality checks");

  // 2. Prove runtime injector (src/injector.js) contains no if-react or if-vite branches
  const injectorSrc = await fsp.readFile(path.join(REPO, "src", "injector.js"), "utf8");
  assert.ok(
    !/if\s*\([^)]*===\s*["']react["']\)/i.test(injectorSrc),
    "src/injector.js must not contain ad-hoc if (framework === 'react') branches"
  );
  assert.ok(
    !/if\s*\([^)]*===\s*["']vite["']\)/i.test(injectorSrc),
    "src/injector.js must not contain ad-hoc if (framework === 'vite') branches"
  );

  // 3. Prove framework behavior is composed from template fragments on disk
  const archDirs = await fsp.readdir(path.join(TEMPLATES_DIR, "architectures"));
  assert.ok(archDirs.includes("feature-based"), "feature-based template fragment exists");
  assert.ok(archDirs.includes("type-based"), "type-based template fragment exists");

  const condDirs = await fsp.readdir(path.join(TEMPLATES_DIR, "conditional"));
  assert.ok(condDirs.includes("router"), "router conditional fragment exists");
  assert.ok(condDirs.includes("icons"), "icons conditional fragment exists");
  assert.ok(condDirs.includes("state"), "state conditional fragment exists");
  assert.ok(condDirs.includes("testing"), "testing conditional fragment exists");
  assert.ok(condDirs.includes("linting"), "linting conditional fragment exists");
  assert.ok(condDirs.includes("formatter"), "formatter conditional fragment exists");

  const cssDirs = await fsp.readdir(path.join(TEMPLATES_DIR, "css"));
  assert.ok(cssDirs.includes("tailwind"), "tailwind styling fragment exists");
  assert.ok(cssDirs.includes("component-styles"), "component-styles fragment exists");
});

test("Epic #10 / E1: Scaffolding a React/Vite project twice produces byte-identical files (Pass 1 == Pass 2, TS + Tailwind)", async () => {
  const baseApp = await ensureBase("ts");
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const dirPass1 = path.join(os.tmpdir(), `lumen-det-ts-p1-${randomSuffix}`);
  const dirPass2 = path.join(os.tmpdir(), `lumen-det-ts-p2-${randomSuffix}`);

  const responses = {
    projectName: "deterministic-app",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "zustand",
    iconLibrary: "lucide",
    apiClient: "axios",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };

  try {
    await generateProject(responses, baseApp, dirPass1);
    await generateProject(responses, baseApp, dirPass2);

    const files1 = await collectFilesRecursive(dirPass1);
    const files2 = await collectFilesRecursive(dirPass2);

    // Structure identity
    assert.deepStrictEqual(files1, files2, "Both generation passes must yield identical file sets");
    assert.ok(files1.length > 20, "Generated project must contain expected scaffolded files");

    // Byte-for-byte content identity
    for (const relPath of files1) {
      const buf1 = await fsp.readFile(path.join(dirPass1, relPath));
      const buf2 = await fsp.readFile(path.join(dirPass2, relPath));

      assert.equal(
        buf1.length,
        buf2.length,
        `File ${relPath} size mismatch: pass1=${buf1.length}B, pass2=${buf2.length}B`
      );

      const byteDiff = Buffer.compare(buf1, buf2);
      assert.equal(
        byteDiff,
        0,
        `File ${relPath} differs byte-for-byte between generation passes`
      );

      const hash1 = crypto.createHash("sha256").update(buf1).digest("hex");
      const hash2 = crypto.createHash("sha256").update(buf2).digest("hex");
      assert.equal(hash1, hash2, `File ${relPath} SHA-256 hash mismatch`);
    }

    // Manifest v2 contract verification
    const m1 = parseManifest(JSON.parse(await fsp.readFile(path.join(dirPass1, "lumen.config.json"), "utf8")));
    const m2 = parseManifest(JSON.parse(await fsp.readFile(path.join(dirPass2, "lumen.config.json"), "utf8")));
    assert.deepStrictEqual(m1, m2, "lumen.config.json manifests must be identical");
  } finally {
    await fsp.rm(dirPass1, { recursive: true, force: true });
    await fsp.rm(dirPass2, { recursive: true, force: true });
  }
});

test("Epic #10 / E1: Scaffolding a React/Vite project twice produces byte-identical files (Pass 1 == Pass 2, JS + CSS Reset)", async () => {
  const baseApp = await ensureBase("js");
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const dirPass1 = path.join(os.tmpdir(), `lumen-det-js-p1-${randomSuffix}`);
  const dirPass2 = path.join(os.tmpdir(), `lumen-det-js-p2-${randomSuffix}`);

  const responses = {
    projectName: "deterministic-app-js",
    architecture: "type-based",
    language: "js",
    cssFramework: "none",
    testing: "jest",
    router: true,
    stateManagement: "redux",
    iconLibrary: "huge",
    apiClient: "fetch",
    linter: "oxlint",
    formatter: "oxfmt",
    gitInit: false,
    readme: true,
  };

  try {
    await generateProject(responses, baseApp, dirPass1);
    await generateProject(responses, baseApp, dirPass2);

    const files1 = await collectFilesRecursive(dirPass1);
    const files2 = await collectFilesRecursive(dirPass2);

    assert.deepStrictEqual(files1, files2, "Both generation passes must yield identical file sets");
    assert.ok(files1.length > 15, "Generated project must contain expected scaffolded files");

    for (const relPath of files1) {
      const buf1 = await fsp.readFile(path.join(dirPass1, relPath));
      const buf2 = await fsp.readFile(path.join(dirPass2, relPath));

      assert.equal(
        Buffer.compare(buf1, buf2),
        0,
        `File ${relPath} differs byte-for-byte between generation passes`
      );
    }
  } finally {
    await fsp.rm(dirPass1, { recursive: true, force: true });
    await fsp.rm(dirPass2, { recursive: true, force: true });
  }
});
