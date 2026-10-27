#!/usr/bin/env node
import { injectArchitecture, injectConditionals, injectFormatter } from "../../src/injector.js";
import { copyEnvExample } from "../../src/env.js";
import { setupCssFramework } from "../../src/css.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";
import { generateReadme } from "../../src/readme.js";
import { runProjectFormat } from "../../src/format.js";
import { getPkgManager } from "../../src/utils/pkg-manager.js";
import { emitManifest } from "../../src/manifest/emit.js";
import { parseManifest } from "../../src/manifest/schema.js";
import { DEFAULT_CELLS, matrix } from "../e2e/matrix.mjs";
import { promises as fsp } from "fs";
import path from "path";
import os from "os";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const TEMPLATES_DIR = path.join(REPO, "templates");
const CACHE = path.join(__dirname, "..", ".cache");
const VENDOR = path.join(CACHE, "vendor");
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
  if (!(await exists(baseApp))) {
    throw new Error(
      `Cached Vite base missing at ${baseApp}. Run \`npm run verify:vendor\` (or generate bases via tests/e2e/exhaustive.mjs) first.`
    );
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
  await configureProject(projectPath, responses.language, responses.cssFramework);
  await cleanupBoilerplate(projectPath);
  await copyEnvExample(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);
  await generateReadme(projectPath, "app", responses);
  await emitManifest(projectPath, responses);
  await fsp.symlink(path.join(VENDOR, "node_modules"), path.join(projectPath, "node_modules"), "junction");
  if (responses.formatter && responses.formatter !== "none") {
    await runProjectFormat(projectPath, responses);
  }
  process.chdir(REPO);
  return projectPath;
}

// Files expected to exist in every generated project regardless of choices.
const PARITY_FILE_CANDIDATES = [
  "src/app/App.tsx", "src/app/App.jsx",
  "src/components/ui/Button.tsx", "src/components/ui/Button.jsx",
  "src/shared/components/ui/Button.tsx", "src/shared/components/ui/Button.jsx",
  "src/main.tsx", "src/main.jsx",
  "scripts/create-feature.mjs",
  "vite.config.ts", "vitest.config.ts", "jest.config.ts",
  "eslint.config.ts", "eslint.config.js",
  "src/types/index.ts", "src/types/index.js",
  "src/shared/types/index.ts", "src/shared/types/index.js",
  "src/config/axios.config.ts", "src/config/axios.config.js",
  "src/services/axios.client.ts", "src/services/axios.client.js",
  "src/services/user.service.ts", "src/services/user.service.js",
  "src/shared/lib/axios/api.config.ts", "src/shared/lib/axios/api.config.js",
  "src/shared/lib/axios/api.client.ts", "src/shared/lib/axios/api.client.js",
  "src/features/home/services/user.service.ts", "src/features/home/services/user.service.js",
  "src/config/api.config.ts", "src/config/api.config.js",
  "src/services/api.client.ts", "src/services/api.client.js",
  "src/shared/api/api.config.ts", "src/shared/api/api.config.js",
  "src/shared/api/api.client.ts", "src/shared/api/api.client.js",
  "src/features/home/services/user.service.ts", "src/features/home/services/user.service.js",
  "src/app/router/index.tsx", "src/app/router/index.jsx",
  "src/app/router/guards/AuthGuard.tsx", "src/app/router/guards/AuthGuard.jsx",
  "src/app/router/guards/RoleGuard.tsx", "src/app/router/guards/RoleGuard.jsx",
  "src/app/router/routes/home.routes.tsx", "src/app/router/routes/home.routes.jsx",
  "src/app/router/routes/auth.routes.tsx", "src/app/router/routes/auth.routes.jsx",
  "src/router/index.tsx", "src/router/index.jsx",
  "src/router/guards/AuthGuard.tsx", "src/router/guards/AuthGuard.jsx",
  "src/router/guards/GuestGuard.tsx", "src/router/guards/GuestGuard.jsx",
  "src/providers/AppProvider.tsx", "src/providers/AppProvider.jsx",
  "src/providers/appcontext.ts", "src/providers/appcontext.js",
  "src/hooks/useApp.ts", "src/hooks/useApp.js",
  "src/app/contexts/themecontext.ts", "src/app/contexts/themecontext.js",
  "src/app/providers/ThemeProvider.tsx", "src/app/providers/ThemeProvider.jsx",
  "src/app/hooks/useTheme.ts", "src/app/hooks/useTheme.js",
  "src/app/providers/StoreProvider.tsx", "src/app/providers/StoreProvider.jsx",
  "src/providers/StoreProvider.tsx", "src/providers/StoreProvider.jsx",
];

// Run a tool binary from the vendored toolchain against the project.
function tool(projectPath, bin, args, opts = {}) {
  const isWin = process.platform === "win32";
  const res = spawnSync(path.join(projectPath, "node_modules", ".bin", bin), args.split(/\s+/), {
    cwd: projectPath,
    encoding: "utf8",
    shell: isWin,
    ...opts,
  });
  const out = (res.stdout || "") + (res.stderr || "");
  return { ok: res.status === 0, exit: res.status ?? "?", stdout: out };
}

// oxlint suppresses its default report when stdout is not a TTY, so the
// harness uses the always-emitted JSON formatter: an empty `diagnostics`
// array means zero findings.
function oxlintFindings(stdout) {
  try {
    const json = JSON.parse(stdout);
    const diags = Array.isArray(json.diagnostics) ? json.diagnostics : [];
    return { count: diags.length, stdout };
  } catch {
    return { count: -1, stdout };
  }
}

function gateNative(projectPath, toolBin, args, label) {
  const res = tool(projectPath, toolBin, args);
  if (!res.ok) {
    return { label, ok: false, why: `(exit ${res.exit}) ${res.stdout.split("\n").filter(Boolean).slice(0, 20).join("\n")}` };
  }
  if (toolBin === "oxlint") {
    const f = oxlintFindings(res.stdout);
    if (f.count !== 0) {
      return {
        label,
        ok: false,
        why: `oxlint reported ${f.count} findings\n${f.stdout.split("\n").filter(Boolean).slice(0, 20).join("\n")}`,
      };
    }
  }
  return { label, ok: true, why: "" };
}

// Cross-probe: with the other toolchain's canonical rc staged, the parity
// file set must satisfy BOTH formatters. Scoped to source/config code because
// oxfmt does not format markdown/HTML and its JSON printer differs from
// Prettier's package.json output.
async function gateCrossProbe(projectPath, toolBin) {
  const files = [];
  for (const f of PARITY_FILE_CANDIDATES) {
    if (await exists(path.join(projectPath, f))) files.push(f);
  }
  if (!files.length) return { label: `cross-${toolBin}`, ok: true, why: "no parity files" };
  const list = files.join(" ");

  let rcName, rcSource;
  if (toolBin === "oxfmt") {
    rcName = ".prettierrc";
    rcSource = path.join(TEMPLATES_DIR, "conditional/formatter/prettier/.prettierrc");
  } else {
    rcName = ".oxfmtrc.json";
    rcSource = path.join(TEMPLATES_DIR, "conditional/formatter/oxfmt/.oxfmtrc.json");
  }
  // Stage the other toolchain's rc under its canonical name — snowflake
  // suffixes break both tools' config loaders.
  const rcPath = path.join(projectPath, rcName);
  const hadRc = await exists(rcPath);
  const rcOrig = hadRc ? await fsp.readFile(rcPath, "utf8") : null;
  await fsp.writeFile(rcPath, await fsp.readFile(rcSource));
  const flag = toolBin === "oxfmt" ? `--config=${rcName}` : `--config ${rcName}`;
  try {
    const res = tool(projectPath, toolBin, `--check ${list} ${flag}`);
    return {
      label: `cross-${toolBin}`,
      ok: res.ok,
      why: res.ok ? "" : res.stdout.split("\n").filter(Boolean).slice(0, 12).join("\n"),
    };
  } finally {
    if (hadRc) {
      await fsp.writeFile(rcPath, rcOrig);
    } else {
      await fsp.rm(rcPath, { force: true });
    }
  }
}

async function diffTrees(a, b) {
  const norm = (root) => {
    const out = new Map();
    const walk = async (dir, rel) => {
      for (const ent of await fsp.readdir(path.join(root, dir), { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.name === "node_modules") continue;
        if (ent.name === ".env.example") continue;
        if (ent.isDirectory()) {
          await walk(p, rel);
        } else {
          out.set(p, await fsp.readFile(path.join(root, p)));
        }
      }
    };
    return walk(".", "").then(() => out);
  };
  const [x, y] = await Promise.all([norm(a), norm(b)]);
  const names = new Set([...x.keys(), ...y.keys()]);
  for (const name of names) {
    const bx = x.get(name);
    const by = y.get(name);
    if ((bx && by && !bx.equals(by)) || (bx && !by) || (!bx && by)) {
      return `tree differs at ${name}`;
    }
  }
  return null;
}

async function audit(responses, projectPath) {
  const { language, linter, formatter, cssFramework, apiClient, architecture } = responses;
  const extConfig = language === "ts" ? "ts" : "js";
  const errors = [];
  const ok = (cond, msg) => { if (!cond) errors.push(msg); };

  ok(await exists(path.join(projectPath, `src/main.${language === "ts" ? "tsx" : "jsx"}`)), "main entry missing");
  const typesRel =
    architecture === "type-based" || architecture === "none"
      ? `src/types/index.${language === "ts" ? "ts" : "js"}`
      : `src/shared/types/index.${language === "ts" ? "ts" : "js"}`;
  ok(await exists(path.join(projectPath, typesRel)), `${typesRel} missing`);

  const axiosRoutes =
    architecture === "type-based"
      ? [
          `src/config/axios.config.${extConfig}`,
          `src/services/axios.client.${extConfig}`,
          `src/services/user.service.${extConfig}`,
        ]
      : [
          `src/shared/lib/axios/api.config.${extConfig}`,
          `src/shared/lib/axios/api.client.${extConfig}`,
          `src/shared/lib/axios/index.${extConfig}`,
          `src/features/home/services/user.service.${extConfig}`,
        ];
  if (apiClient === "axios") {
    for (const rel of axiosRoutes) {
      ok(await exists(path.join(projectPath, rel)), `${rel} missing`);
    }
    const oldFlat = architecture === "type-based" ? "src/services" : "src/shared/lib";
    ok(
      !(await exists(path.join(projectPath, oldFlat, "axios.ts"))) &&
        !(await exists(path.join(projectPath, oldFlat, "axios.jsx"))),
      "old flat axios file present"
    );
  } else if (apiClient === "fetch") {
    const fetchRoutes =
      architecture === "type-based"
        ? [
            `src/config/api.config.${extConfig}`,
            `src/services/api.client.${extConfig}`,
            `src/services/user.service.${extConfig}`,
          ]
        : [
            `src/shared/api/api.config.${extConfig}`,
            `src/shared/api/api.client.${extConfig}`,
            `src/shared/api/index.${extConfig}`,
            `src/features/home/services/user.service.${extConfig}`,
          ];
    for (const rel of fetchRoutes) {
      ok(await exists(path.join(projectPath, rel)), `${rel} missing`);
    }
    const oldMono = architecture === "type-based" ? "src/services" : "src/shared";
    ok(
      !(await exists(path.join(projectPath, oldMono, "api.ts"))) &&
        !(await exists(path.join(projectPath, oldMono, "api.jsx"))),
      "old monolithic api file present"
    );
    if (architecture === "feature-based") {
      ok(
        !(await exists(path.join(projectPath, "src/shared/lib/index.ts"))) &&
          !(await exists(path.join(projectPath, "src/shared/lib/index.js"))),
        "shared/lib/index still present"
      );
    }
  } else {
    ok(
      !(await exists(path.join(projectPath, "src/config/axios.config.ts"))) &&
        !(await exists(path.join(projectPath, "src/config/axios.config.js"))),
      `stray config/axios.config (${apiClient})`
    );
    ok(!(await exists(path.join(projectPath, "src/lib/axios"))), `stray lib/axios (${apiClient})`);
    // feature-based ships `shared/lib` only when axios is chosen, so an empty
    // placeholder never leaks alone — check real client files for leaks.
    if (architecture === "type-based") {
      ok(!(await exists(path.join(projectPath, "src/shared/lib/axios"))), `stray shared/lib/axios (${apiClient})`);
    } else {
      ok(
        !(await exists(path.join(projectPath, "src/shared/lib/axios/api.client.ts"))) &&
          !(await exists(path.join(projectPath, "src/shared/lib/axios/api.client.js"))),
        `stray shared/lib/axios api.client (${apiClient})`
      );
    }
    ok(
      !(await exists(path.join(projectPath, "src/services/axios.client.ts"))) &&
        !(await exists(path.join(projectPath, "src/services/axios.client.js"))),
      `stray services/axios.client (${apiClient})`
    );
    ok(
      !(await exists(path.join(projectPath, "src/config/api.config.ts"))) &&
        !(await exists(path.join(projectPath, "src/config/api.config.js"))),
      `stray config/api.config (${apiClient})`
    );
    ok(!(await exists(path.join(projectPath, "src/lib/api"))), `stray lib/api (${apiClient})`);
    if (architecture === "type-based") {
      ok(!(await exists(path.join(projectPath, "src/shared/api"))), `stray shared/api (${apiClient})`);
    } else {
      ok(
        !(await exists(path.join(projectPath, "src/shared/api/api.client.ts"))) &&
          !(await exists(path.join(projectPath, "src/shared/api/api.client.js"))),
        `stray shared/api api.client (${apiClient})`
      );
    }
  }
  ok(
    !(await exists(path.join(projectPath, "src/config/constants.ts"))) &&
      !(await exists(path.join(projectPath, "src/config/constants.js"))),
    "config/constants still present"
  );

  // Pase 4: dead service barrels (no consumers) are removed in both architectures,
  // while the public feature barrel and per-feature types/.gitkeep are kept.
  const deadSvcBarrels = architecture === "type-based" ? ["src/services/index"] : ["src/features/home/services/index"];
  for (const rel of deadSvcBarrels) {
    ok(
      !(await exists(path.join(projectPath, `${rel}.${extConfig}`))) &&
        !(await exists(path.join(projectPath, `${rel}.${extConfig === "ts" ? "js" : "ts"}`))),
      `dead service barrel still present: ${rel}`
    );
  }
  if (architecture === "feature-based") {
    const activeLang = language === "ts" ? "ts" : "js";
    ok(
      await exists(path.join(projectPath, `src/features/home/index.${activeLang}`)),
      `features/home public barrel (${activeLang}) missing`
    );
    ok(
      await exists(path.join(projectPath, "src/features/home/types/.gitkeep")),
      "features/home/types/.gitkeep missing"
    );
  }

  if (linter === "eslint") {
    ok(await exists(path.join(projectPath, `eslint.config.${extConfig}`)), "eslint config missing");
  }
  if (linter === "oxlint") {
    ok(await exists(path.join(projectPath, "oxlintrc.json")), "oxlintrc.json missing");
  }

  // Manifest v2 contract gate (#23, #16)
  const manifestPath = path.join(projectPath, "lumen.config.json");
  ok(await exists(manifestPath), "lumen.config.json missing");
  try {
    const raw = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
    const parsed = parseManifest(raw);
    ok(parsed.manifestVersion === 2, "manifestVersion !== 2");
    ok(parsed.framework.name === (responses.framework || "react"), "manifest framework mismatch");
  } catch (err) {
    ok(false, `lumen.config.json schema validation failed: ${err.message}`);
  }
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  const scripts = pkgJson.scripts || {};
  if (formatter === "prettier") {
    ok(await exists(path.join(projectPath, ".prettierrc")), ".prettierrc missing");
    ok(scripts.format === "prettier --write .", "prettier format script");
  } else if (formatter === "oxfmt") {
    ok(await exists(path.join(projectPath, ".oxfmtrc.json")), ".oxfmtrc.json missing");
    ok(scripts.format === "oxfmt .", "oxfmt format script");
  }
  if (cssFramework !== "tailwind") {
    const vite = await fsp.readFile(path.join(projectPath, `vite.config.${extConfig}`), "utf8");
    ok(/(?:["'])@(?:["'])/.test(vite) || vite.includes("find: @"), "vite @ alias missing");
  }

  // Manifest v2 contract verification (#23)
  ok(await exists(path.join(projectPath, "lumen.config.json")), "lumen.config.json missing (#23)");
  const manifest = parseManifest(JSON.parse(await fsp.readFile(path.join(projectPath, "lumen.config.json"), "utf8")));
  ok(manifest.manifestVersion === 2, "manifestVersion must be 2");
  ok(manifest.framework.name === "react", "framework must be react");
  ok(manifest.tooling.language === language, "language mismatch in manifest");

  // CSS framework parity (regression gate for the v1.2.0 globals path fix):
  // the main stylesheet the architecture actually imports must carry the
  // selected framework's content (main.css for vanilla, globals.css for
  // tailwind), themes.css must live next to it, and src/index.css
  // (Vite leftover) must be absent.
  const mainFileName = cssFramework === "none" ? "main.css" : "globals.css";
  const mainRel =
    architecture === "feature-based"
      ? `src/shared/styles/${mainFileName}`
      : `src/styles/${mainFileName}`;
  const themesRel =
    architecture === "feature-based"
      ? "src/shared/styles/themes.css"
      : "src/styles/themes.css";
  if (await exists(path.join(projectPath, mainRel))) {
    const main = await fsp.readFile(path.join(projectPath, mainRel), "utf8");
    if (cssFramework === "tailwind") {
      ok(/@import[^;]*tailwindcss/.test(main), "css: tailwind import missing");
    } else if (cssFramework === "none") {
      ok(main.includes("box-sizing"), "css: reset missing (cssFramework none)");
      ok(main.includes("var(--color-"), "css: vanilla stylesheet should consume CSS variables");
    }
  }
  ok(
    !(await exists(path.join(projectPath, "src/index.css"))),
    "css: src/index.css should not exist"
  );
  ok(
    await exists(path.join(projectPath, themesRel)),
    "css: themes.css missing"
  );
  const homeRel =
    architecture === "feature-based"
      ? `src/features/home/pages/HomePage.${language === "ts" ? "tsx" : "jsx"}`
      : `src/pages/Home/Home.${language === "ts" ? "tsx" : "jsx"}`;
  if (await exists(path.join(projectPath, homeRel))) {
    const home = await fsp.readFile(path.join(projectPath, homeRel), "utf8");
    const hasTailwind = /text-(?:gray|blue|yellow|4xl|xl)|bg-gray-|w-8 h-8/.test(home);
    const hasBootstrap = /text-muted|d-flex|fw-bold|btn-primary/.test(home);
    if (cssFramework === "tailwind") {
      ok(hasTailwind && !hasBootstrap, `home: tailwind markup expected under tailwind`);
    } else {
      ok(!hasTailwind && !hasBootstrap, `home: inline markup expected under none`);
    }
  }
  if (architecture === "type-based") {
    ok(!(await exists(path.join(projectPath, "src/components/layout"))), "components/layout still present");
  }
  return errors;
}

async function runCell(responses, index, { determinism, quiet }) {
  const baseApp = await ensureBase(responses.language);
  const projectPath = path.join(os.tmpdir(), `lumen-ver-${index}`);
  if (determinism) {
    const b = path.join(os.tmpdir(), `lumen-ver-${index}-b`);
    await generate(responses, baseApp, projectPath);
    await generate(responses, baseApp, b);
    const diff = await diffTrees(projectPath, b);
    await fsp.rm(b, { recursive: true, force: true });
    if (diff) return { status: "DETERMINISM-FAIL", why: diff, path: projectPath };
  } else {
    await generate(responses, baseApp, projectPath);
  }

  const gates = [];
  if (responses.linter === "oxlint") {
    gates.push(gateNative(projectPath, "oxlint", ". --format=json", "oxlint"));
  }
  if (responses.linter === "eslint") {
    gates.push(gateNative(projectPath, "eslint", ". --max-warnings=0", "eslint"));
  }
  if (responses.formatter === "prettier") {
    gates.push(gateNative(projectPath, "prettier", "--check .", "prettier"));
  }
  if (responses.formatter === "oxfmt") {
    gates.push(gateNative(projectPath, "oxfmt", "--check .", "oxfmt"));
  }
  // Cross-tool parity probe only when a formatter was chosen.
  if (responses.formatter === "prettier") gates.push(await gateCrossProbe(projectPath, "oxfmt"));
  if (responses.formatter === "oxfmt") gates.push(await gateCrossProbe(projectPath, "prettier"));

  // Format idempotence gate (#24 AC): second format pass must remain fully clean
  if (responses.formatter && responses.formatter !== "none") {
    await runProjectFormat(projectPath, responses);
    if (responses.formatter === "prettier") {
      gates.push(gateNative(projectPath, "prettier", "--check .", "prettier-idempotence"));
    } else if (responses.formatter === "oxfmt") {
      gates.push(gateNative(projectPath, "oxfmt", "--check .", "oxfmt-idempotence"));
    }
  }

  const auditErrors = await audit(responses, projectPath);
  const failures = gates.filter((g) => !g.ok);
  if (failures.length || auditErrors.length) {
    const why = [...failures.map((f) => `-- ${f.label}: ${f.why || ""}`), ...auditErrors.map((e) => `-- audit: ${e}`)].join("\n");
    return { status: "FAIL", why, path: projectPath };
  }
  if (!quiet) console.log(`PASS  ${JSON.stringify(responses)}`);
  await fsp.rm(projectPath, { recursive: true, force: true });
  return { status: "PASS" };
}

async function main() {
  const full = process.env.FULL === "1" || process.env.FULL === "true";
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const cells = full ? matrix() : DEFAULT_CELLS;

  console.log(full ? "OFFLINE VERIFY (FULL matrix)" : "OFFLINE VERIFY (stratified default cells)");
  console.log("vendor toolchain:", VENDOR);

  // Sanity: vendor must be installed.
  if (!(await exists(path.join(VENDOR, "node_modules", ".bin", "eslint")) || await exists(path.join(VENDOR, "node_modules", ".bin", "oxfmt")))) {
    console.error("Missing vendored toolchain. Run `npm run verify:vendor` first.");
    process.exit(2);
  }

  let n = 0;
  const failures = [];
  for (const responses of cells) {
    if (n >= limit) break;
    n++;
    const res = await runCell(responses, n, { determinism: !full, quiet: full && n > 3 });
    if (res.status !== "PASS") {
      failures.push({ n, responses, res });
      if (!full) {
        console.error(`FAIL #${n} ${JSON.stringify(responses)}`);
        console.error(res.why);
      }
    }
  }

  const summary = `\nverify-offline: ${n} cells, ${failures.length} failures, gen+gate-duration checked.`;
  console.log(summary);
  if (failures.length) {
    for (const f of failures.slice(0, 30)) {
      console.log(`\n#${f.n} ${JSON.stringify(f.responses)}`);
      console.log(f.res.why.split("\n").slice(0, 30).map((l) => "   " + l).join("\n"));
    }
    if (full) console.log(`\nProject retained at ${failures[0].res.path}`);
    process.exit(1);
  }
  console.log("All cells passed.");
}

main().catch((e) => {
  console.error("\nHARNESS ERROR:", e.message || e);
  process.exit(1);
});