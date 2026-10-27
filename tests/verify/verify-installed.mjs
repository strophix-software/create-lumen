#!/usr/bin/env node
// Real-install verification: scaffolds a sampled project, runs a genuine
// `npm install`, then gates lint (zero-warnings), format idempotence, tests,
// and the production build. Requires network + a package manager.
import { injectArchitecture, injectConditionals, injectFormatter } from "../../src/injector.js";
import { installAllDeps } from "../../src/dependencies.js";
import { copyEnvExample } from "../../src/env.js";
import { setupCssFramework } from "../../src/css.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";
import { generateReadme } from "../../src/readme.js";
import { runProjectFormat } from "../../src/format.js";
import { getPkgManager } from "../../src/utils/pkg-manager.js";
import { DEFAULT_CELLS } from "../e2e/matrix.mjs";
import { promises as fsp } from "fs";
import { readdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import os from "os";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const TEMPLATES_DIR = path.join(REPO, "templates");
const CACHE = path.join(__dirname, "..", ".cache");
const pkg = getPkgManager();

// Sampled cells for the default run (degree of freedom per project type that
// the offline harness cannot exercise: real dep resolution + build + test).
const INSTALL_CELLS = [
  { architecture: "feature-based", language: "ts", cssFramework: "tailwind", testing: "vitest", router: true, stateManagement: "none", iconLibrary: "none", apiClient: "none", linter: "eslint", formatter: "prettier" },
  { architecture: "type-based", language: "js", cssFramework: "tailwind", testing: "jest", router: true, stateManagement: "redux", iconLibrary: "huge", apiClient: "fetch", linter: "eslint", formatter: "prettier" },
  { architecture: "feature-based", language: "ts", cssFramework: "none", testing: "vitest", router: false, stateManagement: "zustand", iconLibrary: "lucide", apiClient: "axios", linter: "oxlint", formatter: "oxfmt" },
  { architecture: "type-based", language: "ts", cssFramework: "none", testing: "jest", router: false, stateManagement: "redux", iconLibrary: "none", apiClient: "axios", linter: "eslint", formatter: "prettier" },
];

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
  if (!(await exists(baseApp))) {
    throw new Error(`Cached Vite base missing at ${baseApp}. Run \`npm run verify:vendor\` first.`);
  }
  return baseApp;
}

async function generate(responses, baseApp, projectPath) {
  process.chdir(REPO);
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.cp(baseApp, projectPath, { recursive: true });

  await injectArchitecture(projectPath, TEMPLATES_DIR, responses.architecture, responses.language, responses.cssFramework);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await setupCssFramework({
    projectPath,
    templatesDir: TEMPLATES_DIR,
    language: responses.language,
    cssFramework: responses.cssFramework,
    architecture: responses.architecture,
    ext: responses.language === "ts" ? "tsx" : "jsx",
    pkg,
  });
  // Real dependency resolution, mirroring src/main.js (this is what actually
  // writes eslint/jiti/prettier/oxlint/vitest/jest/etc into package.json).
  await installAllDeps(responses, pkg, projectPath);
  await configureProject(projectPath, responses.language, responses.cssFramework);
  await cleanupBoilerplate(projectPath);
  await copyEnvExample(projectPath, TEMPLATES_DIR, responses);
  await generateReadme(projectPath, "app", responses);
  process.chdir(REPO);
  return projectPath;
}

function run(cwd, argv, opts = {}) {
  const isWin = process.platform === "win32";
  const res = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8", shell: isWin, ...opts });
  const out = (res.stdout || "") + (res.stderr || "");
  return { status: res.status, out };
}

function hashTree(root) {
  const hash = createHash("sha256");
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
      if (ent.isDirectory()) walk(p);
      else hash.update(ent.name).update(readFileSync(p));
    }
  };
  walk(root);
  return hash.digest("hex");
}

async function gateCell(responses, projectPath) {
  const results = [];
  const runP = (argv, label, { maxWarnings = false } = {}) => {
    const r = run(projectPath, argv);
    results.push({ label, ok: r.status === 0, out: r.out.trim().split("\n").slice(0, 12).join("\n") });
    return r;
  };
  const bin = (name) => path.join(projectPath, "node_modules", ".bin", name);

  // --- Dependencies already resolved via installAllDeps (mirrors src/main.js) ---
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  const dev = pkgJson.devDependencies || {};
  const missingBin = [];
  const BIN_NAMES = { typescript: "tsc", eslint: "eslint", oxlint: "oxlint", prettier: "prettier", oxfmt: "oxfmt", jest: "jest", vitest: "vitest" };
  for (const [dep, binName] of Object.entries(BIN_NAMES)) {
    if (dev[dep] && !(await exists(bin(binName)))) missingBin.push(dep);
  }
  results.push({ label: "dep bins installed", ok: missingBin.length === 0, out: missingBin.length ? `missing ${missingBin.join(", ")}` : "" });
  if (responses.linter === "eslint" && responses.language === "ts") {
    results.push({ label: "jiti devDep", ok: !!dev.jiti, out: dev.jiti ? "" : "eslint+ts must declare jiti (ESLint 10 TS config loader)" });
  }

  // --- Lint (project script, realistic) + strict zero-warning gate ---
  if (responses.linter === "eslint") {
    runP(["npm", "run", "lint"], "npm run lint");
    runP([bin("eslint"), ".", "--max-warnings=0"], "eslint zero-warnings");
  } else if (responses.linter === "oxlint") {
    runP(["npm", "run", "lint"], "npm run lint");
    runP([bin("oxlint"), ".", "--deny-warnings"], "oxlint zero-warnings");
  }

  // --- Format: idempotence (format, hash, format again) + format:check ---
  if (responses.formatter === "prettier" || responses.formatter === "oxfmt") {
    runP(["npm", "run", "format"], "format (1st)");
    const h1 = hashTree(projectPath);
    runP(["npm", "run", "format"], "format (2nd)");
    const h2 = hashTree(projectPath);
    if (h1 !== h2) results.push({ label: "format idempotence", ok: false, out: "second format changed files" });
    else results.push({ label: "format idempotence", ok: true, out: "" });
    runP(["npm", "run", "format:check"], "format:check");
  }

  // --- Tests ---
  if (responses.testing === "vitest") {
    runP(["npm", "run", "test:run"], "vitest run");
  } else if (responses.testing === "jest") {
    runP(["npm", "test", "--", "--ci"], "jest --ci");
  }

  // --- Type check (TS only): the generated `typecheck` script gates tsc -b
  //      over the generated tsconfig graph ---
  if (responses.language === "ts") {
    const scriptsJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8")).scripts || {};
    results.push({ label: "typecheck script", ok: scriptsJson.typecheck === "tsc -b", out: scriptsJson.typecheck ? "" : "typecheck script missing" });
    runP(["npm", "run", "typecheck"], "npm run typecheck (tsc -b)");
  } else {
    const scriptsJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8")).scripts || {};
    results.push({ label: "no typecheck script (js)", ok: !scriptsJson.typecheck, out: scriptsJson.typecheck ? "typecheck script present in js" : "" });
  }

  // --- Build (vite build; typechecking is gated separately per the generated
  //      scripts, which intentionally keep build independent of tsc) ---
  runP(["npm", "run", "build"], "npm run build");

  return results;
}

async function main() {
  const full = process.env.FULL === "1" || process.env.FULL === "true";
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const cells = full ? DEFAULT_CELLS : INSTALL_CELLS;

  console.log(full ? "INSTALL VERIFY (matrix subset)" : "INSTALL VERIFY (sampled cells)");
  console.log(`Verified cell configs: ${cells.length}`);

  const pwd = process.cwd();
  let n = 0;
  let failures = 0;
  for (const responses of cells) {
    if (n >= limit) break;
    n++;
    const baseApp = await ensureBase(responses.language);
    const projectPath = path.join(os.tmpdir(), `lumen-inst-${n}-${Date.now()}`);
    console.log(`\n=== cell ${n}: ${JSON.stringify(responses)}`);
    await generate(responses, baseApp, projectPath);
    let cellFails = 0;
    const results = await gateCell(responses, projectPath);

    for (const r of results) {
      const mark = r.ok ? "PASS" : "FAIL";
      if (!r.ok) {
        cellFails++;
        failures++;
      }
      console.log(`  ${mark}  ${r.label}${r.out ? `\n      ${r.out.split("\n").join("\n      ")}` : ""}`);
    }
    if (cellFails > 0) {
      console.log(`  (project retained for inspection: ${projectPath})`);
    } else {
      await fsp.rm(projectPath, { recursive: true, force: true });
    }
  }
  process.chdir(pwd);

  console.log(`\nverify-installed: ${n} cells, ${failures} gate failures.`);
  if (failures) process.exit(1);
  console.log("All cells passed.");
}

main().catch((e) => {
  console.error("\nHARNESS ERROR:", e.message || e);
  process.exit(1);
}).finally(() => {
  // The harness must never leave a process alive in a deleted tmp cwd.
  try { process.chdir(REPO); } catch {}
});