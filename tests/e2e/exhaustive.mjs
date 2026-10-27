import { runViteCreate } from "../../src/scaffold.js";
import { injectArchitecture, injectConditionals, injectFormatter } from "../../src/injector.js";
import { copyEnvExample } from "../../src/env.js";
import { setupCssFramework } from "../../src/css.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";
import { generateReadme } from "../../src/readme.js";
import { getPkgManager } from "../../src/utils/pkg-manager.js";
import { axes, matrix } from "./matrix.mjs";
import { promises as fsp } from "fs";
import path from "path";
import os from "os";
import assert from "assert";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const TEMPLATES_DIR = path.join(REPO, "templates");
const CACHE = path.join(__dirname, "..", ".cache");
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

async function generate(responses, baseApp, projectPath) {
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
  if (responses.readme) await generateReadme(projectPath, "app", responses);
  process.chdir(REPO);
  return projectPath;
}

async function check(responses, projectPath) {
  const { language, architecture, cssFramework, testing, router, stateManagement, linter, formatter, apiClient } = responses;
  const ext = language === "ts" ? "tsx" : "jsx";
  const extConfig = language === "ts" ? "ts" : "js";
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  const scripts = pkgJson.scripts || {};

  // Architecture
  if (architecture === "feature-based") {
    assert.ok(await exists(path.join(projectPath, "src/app")), "feature-based: src/app missing");
  } else {
    assert.ok(await exists(path.join(projectPath, "src/components")), "type-based: src/components missing");
  }

  // Main entry present, opposite removed
  assert.ok(await exists(path.join(projectPath, `src/main.${ext}`)), `main.${ext} missing`);
  assert.ok(!(await exists(path.join(projectPath, `src/main.${language === "ts" ? "jsx" : "tsx"}`))), "opposite main not removed");

  // CSS framework
  if (cssFramework === "tailwind") {
    const vite = await fsp.readFile(path.join(projectPath, `vite.config.${extConfig}`), "utf8");
    assert.ok(vite.includes("@tailwindcss/vite"), "tailwind: vite plugin missing");
  }

  // Testing
  if (testing === "vitest") {
    assert.ok(await exists(path.join(projectPath, `vitest.config.${extConfig}`)), "vitest: config missing");
    assert.ok(await exists(path.join(projectPath, "src/test/setup." + extConfig)), "vitest: setup missing");
    assert.ok(await exists(path.join(projectPath, `src/__tests__/App.test.${ext}`)), "vitest: test missing");
    assert.strictEqual(scripts.test, "vitest", "vitest: test script");
    assert.strictEqual(scripts["test:run"], "vitest run", "vitest: test:run script");
  } else if (testing === "jest") {
    assert.ok(await exists(path.join(projectPath, `jest.config.${extConfig}`)), "jest: config missing");
    assert.ok(await exists(path.join(projectPath, `jest.setup.${extConfig}`)), "jest: setup missing");
    assert.ok(await exists(path.join(projectPath, `src/__tests__/App.test.${ext}`)), "jest: test missing");
    assert.strictEqual(scripts.test, "jest", "jest: test script");
    assert.strictEqual(scripts["test:watch"], "jest --watch", "jest: test:watch script");
  } else {
    assert.ok(!(await exists(path.join(projectPath, `vitest.config.${extConfig}`))), "none testing: stray vitest config");
    assert.ok(!(await exists(path.join(projectPath, `jest.config.${extConfig}`))), "none testing: stray jest config");
    assert.ok(!scripts.test, "none testing: stray test script");
  }

  // State management
  const main = await fsp.readFile(path.join(projectPath, `src/main.${ext}`), "utf8");
  if (stateManagement === "redux") {
    assert.ok(main.includes("StoreProvider"), "redux: StoreProvider not wired into main");
    const providerPath =
      architecture === "feature-based"
        ? path.join(projectPath, `src/app/providers/StoreProvider.${ext}`)
        : path.join(projectPath, `src/providers/StoreProvider.${ext}`);
    assert.ok(await exists(providerPath), "redux: StoreProvider file missing");
    assert.ok(
      !(await exists(path.join(projectPath, "src/context"))),
      "redux comp: legacy src/context/ should not exist"
    );
  } else {
    assert.ok(!main.includes("StoreProvider"), `non-redux: StoreProvider should be absent (${stateManagement})`);
  }

  // Providers / contexts (split: feat contexts/ + providers/, comp co-localized in providers/)
  if (architecture === "feature-based") {
    assert.ok(
      await exists(path.join(projectPath, `src/app/contexts/themecontext.${ext === "tsx" ? "ts" : "js"}`)),
      "feat: app/contexts/themecontext missing"
    );
    assert.ok(
      await exists(path.join(projectPath, `src/app/providers/ThemeProvider.${ext}`)),
      "feat: app/providers/ThemeProvider missing"
    );
    assert.ok(
      await exists(path.join(projectPath, `src/app/hooks/useTheme.${ext === "tsx" ? "ts" : "js"}`)),
      "feat: app/hooks/useTheme missing"
    );
  } else {
    assert.ok(
      await exists(path.join(projectPath, `src/providers/AppProvider.${ext}`)),
      "comp: providers/AppProvider missing"
    );
    assert.ok(
      await exists(path.join(projectPath, `src/providers/appcontext.${ext === "tsx" ? "ts" : "js"}`)),
      "comp: providers/appcontext missing"
    );
    assert.ok(
      await exists(path.join(projectPath, `src/hooks/useApp.${ext === "tsx" ? "ts" : "js"}`)),
      "comp: hooks/useApp missing"
    );
    assert.ok(
      !(await exists(path.join(projectPath, "src/context"))),
      "comp: legacy src/context/ should not exist"
    );
  }

  // Router
  if (router) {
    const base = architecture === "feature-based" ? "src/app/router" : "src/router";
    assert.ok(await exists(path.join(projectPath, `${base}/index.${ext}`)), `router: ${base}/index missing`);
    assert.ok(await exists(path.join(projectPath, `${base}/guards/AuthGuard.${ext}`)), "router: guards/AuthGuard missing");
    if (architecture === "feature-based") {
      assert.ok(await exists(path.join(projectPath, `${base}/guards/RoleGuard.${ext}`)), "router: guards/RoleGuard missing");
      assert.ok(await exists(path.join(projectPath, `${base}/routes/home.routes.${ext}`)), "router: routes/home.routes missing");
      assert.ok(await exists(path.join(projectPath, `${base}/routes/auth.routes.${ext}`)), "router: routes/auth.routes missing");
    } else {
      assert.ok(await exists(path.join(projectPath, `${base}/guards/GuestGuard.${ext}`)), "router: guards/GuestGuard missing");
      assert.ok(
        !(await exists(path.join(projectPath, `${base}/routes`))),
        `router: ${base}/routes should not exist (centralized router)`
      );
    }
  }

  // Linter
  if (linter === "eslint") {
    assert.ok(await exists(path.join(projectPath, `eslint.config.${extConfig}`)), "eslint: config missing");
    assert.strictEqual(scripts.lint, "eslint .", "eslint: lint script");
    assert.strictEqual(scripts["lint:fix"], "eslint . --fix", "eslint: lint:fix script");
  } else if (linter === "oxlint") {
    assert.ok(await exists(path.join(projectPath, "oxlintrc.json")), "oxlint: config missing");
    assert.strictEqual(scripts.lint, "oxlint .", "oxlint: lint script");
  } else {
    // linter "none": the Vite base template may already ship an eslint config
    // and a `lint` script, which the generator leaves in place — so we don't
    // assert their absence here.
  }

  // Formatter
  if (formatter === "prettier") {
    assert.ok(await exists(path.join(projectPath, ".prettierrc")), ".prettierrc missing");
    assert.strictEqual(scripts.format, "prettier --write .", "format script");
    assert.strictEqual(scripts["format:check"], "prettier --check .", "format:check script");
    if (linter === "eslint") {
      const cfg = await fsp.readFile(path.join(projectPath, `eslint.config.${extConfig}`), "utf8");
      assert.ok(cfg.includes('import prettier from "eslint-config-prettier";'), "eslint+prettier: import missing");
      assert.ok(/prettier,\s*\n\s*[)\]];/.test(cfg), "eslint+prettier: prettier not last");
    }
  } else if (formatter === "oxfmt") {
    assert.ok(await exists(path.join(projectPath, ".oxfmtrc.json")), ".oxfmtrc.json missing");
    assert.strictEqual(scripts.format, "oxfmt .", "format script");
  } else {
    assert.ok(!(await exists(path.join(projectPath, ".prettierrc"))), "none formatter: stray .prettierrc");
    assert.ok(!(await exists(path.join(projectPath, ".oxfmtrc.json"))), "none formatter: stray .oxfmtrc.json");
    assert.ok(!scripts.format, "none formatter: stray format script");
  }

  // @/ alias
  if (language === "ts") {
    assert.ok(await exists(path.join(projectPath, "tsconfig.json")), "ts: tsconfig.json missing");
    assert.ok(await exists(path.join(projectPath, "tsconfig.app.json")), "ts: tsconfig.app.json missing");
    const app = await fsp.readFile(path.join(projectPath, "tsconfig.app.json"), "utf8");
    assert.ok(app.includes('"@/*"'), "ts: @/* path missing");
  } else {
    assert.ok(await exists(path.join(projectPath, "jsconfig.json")), "js: jsconfig.json missing");
    const js = await fsp.readFile(path.join(projectPath, "jsconfig.json"), "utf8");
    assert.ok(js.includes('"@/*"'), "js: @/* path missing");
  }

  // Typecheck script (TS only)
  if (language === "ts") {
    assert.strictEqual(scripts.typecheck, "tsc -b", "ts: typecheck script");
  } else {
    assert.ok(!scripts.typecheck, "js: typecheck script should be absent");
  }

  // types/ parity: both architectures ship a types index in the active language
  // (type-based at src/types, feature-based at src/shared/types)
  const typesRel =
    architecture === "type-based"
      ? `src/types/index.${language === "ts" ? "ts" : "js"}`
      : `src/shared/types/index.${language === "ts" ? "ts" : "js"}`;
  assert.ok(
    await exists(path.join(projectPath, typesRel)),
    `types: ${typesRel} missing`
  );

  // axios API client layer
  if (apiClient === "axios") {
    if (architecture === "type-based") {
      assert.ok(await exists(path.join(projectPath, `src/config/axios.config.${extConfig}`)), "axios: config/axios.config missing");
      assert.ok(await exists(path.join(projectPath, `src/services/axios.client.${extConfig}`)), "axios: services/axios.client missing");
      assert.ok(await exists(path.join(projectPath, `src/services/user.service.${extConfig}`)), "axios: services/user.service missing");
    } else {
      assert.ok(await exists(path.join(projectPath, `src/shared/lib/axios/api.config.${extConfig}`)), "axios: shared/lib/axios/api.config missing");
      assert.ok(await exists(path.join(projectPath, `src/shared/lib/axios/api.client.${extConfig}`)), "axios: shared/lib/axios/api.client missing");
      assert.ok(await exists(path.join(projectPath, `src/shared/lib/axios/index.${extConfig}`)), "axios: shared/lib/axios/index missing");
      assert.ok(await exists(path.join(projectPath, `src/features/home/services/user.service.${extConfig}`)), "axios: features/home/services/user.service missing");
    }
    assert.ok(
      !(await exists(path.join(projectPath, architecture === "type-based" ? "src/services/axios.ts" : "src/shared/lib/axios.ts"))) &&
        !(await exists(path.join(projectPath, architecture === "type-based" ? "src/services/axios.jsx" : "src/shared/lib/axios.jsx"))),
      "axios: old flat axios file present"
    );
    if (architecture === "feature-based") {
      assert.ok(!(await exists(path.join(projectPath, "src/shared/api"))), "axios: stray shared/api folder");
    } else {
      assert.ok(!(await exists(path.join(projectPath, "src/services/.gitkeep"))), "axios: stray services/.gitkeep");
    }
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
      assert.ok(await exists(path.join(projectPath, rel)), `fetch: ${rel} missing`);
    }
    assert.ok(
      !(await exists(path.join(projectPath, architecture === "type-based" ? "src/services/api.ts" : "src/shared/api.ts"))) &&
        !(await exists(path.join(projectPath, architecture === "type-based" ? "src/services/api.jsx" : "src/shared/api.jsx"))),
      "fetch: old monolithic api file present"
    );
    if (architecture === "feature-based") {
      assert.ok(!(await exists(path.join(projectPath, "src/shared/lib/index.ts"))), "fetch: shared/lib/index.ts present");
      assert.ok(!(await exists(path.join(projectPath, "src/shared/lib/index.js"))), "fetch: shared/lib/index.js present");
      assert.ok(!(await exists(path.join(projectPath, "src/shared/lib"))), "fetch: stray shared/lib folder");
    } else {
      assert.ok(!(await exists(path.join(projectPath, "src/services/.gitkeep"))), "fetch: stray services/.gitkeep");
    }
  } else {
    assert.ok(
      !(await exists(path.join(projectPath, "src/config/axios.config.ts"))) &&
        !(await exists(path.join(projectPath, "src/config/axios.config.js"))),
      `non-axios: stray config/axios.config (${apiClient})`
    );
    assert.ok(!(await exists(path.join(projectPath, "src/lib/axios"))) && !(await exists(path.join(projectPath, "src/shared/lib/axios"))), `non-axios: stray lib/axios (${apiClient})`);
    if (architecture === "feature-based") {
      assert.ok(!(await exists(path.join(projectPath, "src/shared/lib"))), `non-axios: stray shared/lib (${apiClient})`);
    }
    assert.ok(
      !(await exists(path.join(projectPath, "src/config/api.config.ts"))) &&
        !(await exists(path.join(projectPath, "src/config/api.config.js"))),
      `non-fetch: stray config/api.config (${apiClient})`
    );
    assert.ok(!(await exists(path.join(projectPath, "src/lib/api"))) && !(await exists(path.join(projectPath, "src/shared/api"))), `non-fetch: stray lib/api (${apiClient})`);
  }

  // Pase 4: dead service barrels (no consumers) removed in both architectures.
  const deadSvc = architecture === "type-based" ? "src/services/index" : "src/features/home/services/index";
  assert.ok(
    !(await exists(path.join(projectPath, `${deadSvc}.${extConfig}`))) &&
      !(await exists(path.join(projectPath, `${deadSvc}.${extConfig === "ts" ? "js" : "ts"}`))),
    `pase4: dead service barrel still present: ${deadSvc}`
  );
  // feature-based keeps the public home barrel + per-feature types/.gitkeep.
  if (architecture === "feature-based") {
    assert.ok(await exists(path.join(projectPath, `src/features/home/index.${extConfig}`)), "pase4: features/home/index missing");
    assert.ok(await exists(path.join(projectPath, "src/features/home/types/.gitkeep")), "pase4: features/home/types/.gitkeep missing");
  }

  // config/constants dropped in every scaffold
  assert.ok(!(await exists(path.join(projectPath, "src/config/constants.ts"))), "constants: src/config/constants.ts present");
  assert.ok(!(await exists(path.join(projectPath, "src/config/constants.js"))), "constants: src/config/constants.js present");

  // vite config gets the @ alias for non-tailwind setups
  if (cssFramework !== "tailwind") {
    const vite = await fsp.readFile(path.join(projectPath, `vite.config.${extConfig}`), "utf8");
    assert.ok(/(?:["'])@(?:["'])/.test(vite) || vite.includes("find: @"), "vite: @ alias missing");
  }

  // CSS framework markup parity: every architecture expresses the shared look
  // in the chosen framework's idiom (tailwind classes / CSS variables /
  // inline styles), and the imported stylesheet carries that framework's content.
  // Vanilla CSS uses main.css; tailwind keeps globals.css. themes.css lives next
  // to it in every case.
  const mainFileName = cssFramework === "none" ? "main.css" : "globals.css";
  const mainRel =
    architecture === "feature-based"
      ? `src/shared/styles/${mainFileName}`
      : `src/styles/${mainFileName}`;
  const mainCss = await fsp.readFile(path.join(projectPath, mainRel), "utf8");
  const themesRel =
    architecture === "feature-based"
      ? "src/shared/styles/themes.css"
      : "src/styles/themes.css";
  assert.ok(
    await exists(path.join(projectPath, themesRel)),
    "css: themes.css missing (every framework ships one)"
  );
  if (cssFramework === "tailwind") {
    assert.ok(/@import[^;]*tailwindcss/.test(mainCss), "css: tailwind import missing");
  } else if (cssFramework === "none") {
    assert.ok(mainCss.includes("box-sizing"), "css: reset missing (cssFramework none)");
    assert.ok(
      mainCss.includes("var(--color-"),
      "css: vanilla stylesheet should consume CSS variables (none framework)"
    );
  }
  assert.ok(
    !(await exists(path.join(projectPath, "src/index.css"))),
    "css: src/index.css should not exist (Vite leftover; CSS lives in styles/)"
  );
  const homeRel =
    architecture === "feature-based"
      ? `src/features/home/pages/HomePage.${ext}`
      : `src/pages/Home/Home.${ext}`;
  const home = await fsp.readFile(path.join(projectPath, homeRel), "utf8");
  const hasTailwind = /text-(?:gray|blue|yellow|4xl|xl)|bg-gray-|w-8 h-8/.test(home);
  const hasBootstrap = /text-muted|d-flex|fw-bold|btn-primary/.test(home);
  if (cssFramework === "tailwind") {
    assert.ok(hasTailwind && !hasBootstrap, "home: tailwind markup expected under tailwind");
  } else {
    assert.ok(!hasTailwind && !hasBootstrap, "home: inline markup expected under none");
  }
  if (architecture === "type-based") {
    assert.ok(!(await exists(path.join(projectPath, "src/components/layout"))), "components/layout still present");
  }

  // README
  if (responses.readme) {
    assert.ok(await exists(path.join(projectPath, "README.md")), "readme: README.md missing");
    assert.ok(await exists(path.join(projectPath, "LICENSE")), "readme: LICENSE missing");
  }

  // .env.example always scaffolded + env files ignored in git
  assert.ok(await exists(path.join(projectPath, ".env.example")), ".env.example missing");
  const gitignore = await fsp.readFile(path.join(projectPath, ".gitignore"), "utf8");
  assert.ok(gitignore.includes("!.env.example"), ".gitignore: .env.example not whitelisted");
  assert.ok(gitignore.includes(".env"), ".gitignore: env files not ignored");
}

async function main() {
  const bases = {};
  for (const lang of axes.language) bases[lang] = await ensureBase(lang);

  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const skip = process.env.SKIP ? Number(process.env.SKIP) : 0;
  const failures = [];
  let total = 0;

  for (const responses of matrix()) {
    if (skip && total < skip) {
      total++;
      continue;
    }
    if (total - skip >= limit) break;
    total++;
    const projectPath = path.join(os.tmpdir(), `lumen-exh-${total}`);
    try {
      await generate(responses, bases[responses.language], projectPath);
      await check(responses, projectPath);
    } catch (e) {
      failures.push({ n: total, responses, error: e.message });
    } finally {
      await fsp.rm(projectPath, { recursive: true, force: true });
    }
    if (total % 500 === 0) console.log(`  ...${total} generated`);
  }

  console.log(`\nGenerated and checked ${total - skip} configs.`);
  if (failures.length) {
    console.log(`FAILURES: ${failures.length}`);
    for (const f of failures.slice(0, 50)) {
      console.log(`\n#${f.n} ${JSON.stringify(f.responses)}`);
      console.log(`   ${f.error}`);
    }
    process.exit(1);
  }
  console.log("All configs passed.");
}

main().catch((e) => {
  console.error("\nHARNESS ERROR:", e.message || e);
  process.exit(1);
});
