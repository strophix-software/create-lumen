import { test } from "node:test";
import assert from "node:assert";
import { promises as fsp } from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

import { runViteCreate, scaffoldBase } from "../../src/scaffold.js";
import { getProvider } from "../../src/engine/providers/base-provider.js";
import { injectArchitecture, injectConditionals, injectFormatter } from "../../src/injector.js";
import { copyEnvExample } from "../../src/env.js";
import { setupCssFramework } from "../../src/css.js";
import { configureProject } from "../../src/configure.js";
import { cleanupBoilerplate } from "../../src/cleanup.js";
import { generateReadme } from "../../src/readme.js";
import { getPkgManager } from "../../src/utils/pkg-manager.js";
import { emitManifest } from "../../src/manifest/emit.js";
import { parseManifest } from "../../src/manifest/schema.js";
import { emitAgentContext } from "../../src/agent-context.js";

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

// Build a real Vite base once per language (cached offline) — no installs.
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
  await emitManifest(projectPath, responses);
  if (responses.readme) await generateReadme(projectPath, "app", responses);
  await emitManifest(projectPath, responses);
  process.chdir(REPO);
  return projectPath;
}

function quickSetup(language) {
  return {
    projectName: "app",
    architecture: "feature-based",
    language,
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };
}

async function check(responses, projectPath) {
  const { language } = responses;
  const ext = language === "ts" ? "tsx" : "jsx";
  const extConfig = language === "ts" ? "ts" : "js";
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  const scripts = pkgJson.scripts || {};

  const expect = ["dev", "build", "preview", "lint", "lint:fix", "format", "format:check", "test", "test:run"];
  if (language === "ts") expect.push("typecheck");
  for (const s of expect) {
    assert.ok(scripts[s], `missing script: ${s}`);
  }

  if (language === "ts") {
    assert.strictEqual(scripts.typecheck, "tsc -b", "typecheck script");
  }

  assert.ok(await exists(path.join(projectPath, `src/main.${ext}`)), `main.${ext} missing`);
  // The home page App lives at src/App, src/app/App, or src/components/App
  // depending on architecture/router choice.
  const appCandidates = [
    path.join(projectPath, `src/App.${ext}`),
    path.join(projectPath, `src/app/App.${ext}`),
    path.join(projectPath, `src/components/App.${ext}`),
  ];
  assert.ok(appCandidates.some((p) => exists(p)), `App.${ext} missing (checked src/App, src/app/App, src/components/App)`);

  if (language === "ts") {
    assert.ok(await exists(path.join(projectPath, "tsconfig.json")), "tsconfig.json missing");
    assert.ok(await exists(path.join(projectPath, "tsconfig.app.json")), "tsconfig.app.json missing");
    const app = await fsp.readFile(path.join(projectPath, "tsconfig.app.json"), "utf8");
    assert.ok(app.includes('"@/*"'), "@/* alias missing in tsconfig.app.json");
  } else {
    assert.ok(await exists(path.join(projectPath, "jsconfig.json")), "jsconfig.json missing");
    const js = await fsp.readFile(path.join(projectPath, "jsconfig.json"), "utf8");
    assert.ok(js.includes('"@/*"'), "@/* alias missing in jsconfig.json");
  }

  const eslintCfg = path.join(projectPath, `eslint.config.${extConfig}`);
  assert.ok(await exists(eslintCfg), `eslint.config.${extConfig} missing`);
  const cfg = await fsp.readFile(eslintCfg, "utf8");
  assert.ok(cfg.includes('import prettier from "eslint-config-prettier";'), "...prettier import missing");
  assert.ok(/prettier,\s*\n\s*[)\]];/.test(cfg), "...prettier not last in eslint config");

  assert.ok(await exists(path.join(projectPath, ".prettierrc")), ".prettierrc missing");
  assert.ok(await exists(path.join(projectPath, ".env.example")), ".env.example missing");
  const gitignore = await fsp.readFile(path.join(projectPath, ".gitignore"), "utf8");
  assert.ok(gitignore.includes("!.env.example"), ".gitignore: .env.example not whitelisted");
  assert.ok(gitignore.includes(".env"), ".gitignore: env files not ignored");
  assert.ok(await exists(path.join(projectPath, "README.md")), "README.md missing");
  const readme = await fsp.readFile(path.join(projectPath, "README.md"), "utf8");
  assert.ok(readme.includes("ESLint + Prettier"), "README: description missing 'ESLint + Prettier'");
  assert.ok(await exists(path.join(projectPath, "LICENSE")), "LICENSE missing");

  // Manifest v2 contract verification (#23)
  const manifestPath = path.join(projectPath, "lumen.config.json");
  assert.ok(await exists(manifestPath), "lumen.config.json missing (#23)");
  const manifestRaw = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  const manifest = parseManifest(manifestRaw);
  assert.equal(manifest.manifestVersion, 2);
  assert.equal(manifest.framework.name, "react");
  assert.equal(manifest.framework.variant, "vite");
  assert.equal(manifest.tooling.language, language);
  assert.ok(manifest.paths.features);
  assert.ok(manifest.paths.pages);
}

for (const language of ["ts", "js"]) {
  test(`offline smoke: Quick Setup scaffold (${language}) is coherent`, async () => {
    const baseApp = await ensureBase(language);
    const projectPath = path.join(os.tmpdir(), `lumen-smoke-${language}`);
    const out = await generate(quickSetup(language), baseApp, projectPath);
    await check(quickSetup(language), out);
    await fsp.rm(projectPath, { recursive: true, force: true });
  });

  test(`offline smoke: None architecture scaffold (${language}) is coherent`, async () => {
    const noneConfig = {
      projectName: "app",
      architecture: "none",
      language,
      cssFramework: "tailwind",
      testing: "vitest",
      router: false,
      stateManagement: "none",
      iconLibrary: "none",
      apiClient: "none",
      linter: "eslint",
      formatter: "prettier",
      gitInit: false,
      readme: true,
    };
    const baseApp = await ensureBase(language);
    const projectPath = path.join(os.tmpdir(), `lumen-smoke-none-${language}`);
    const out = await generate(noneConfig, baseApp, projectPath);
    const ext = language === "ts" ? "tsx" : "jsx";
    assert.ok(await exists(path.join(out, "src", `App.${ext}`)), `src/App.${ext} missing`);
    assert.ok(await exists(path.join(out, "src", `main.${ext}`)), `src/main.${ext} missing`);
    const manifest = parseManifest(JSON.parse(await fsp.readFile(path.join(out, "lumen.config.json"), "utf8")));
    assert.equal(manifest.architecture.type, "none");
    assert.equal(manifest.paths.features, "src");
    await fsp.rm(projectPath, { recursive: true, force: true });
  });
}

test("offline smoke: shadcn UI kit scaffold (ts) is coherent", async () => {
  const baseApp = await ensureBase("ts");
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-shadcn");
  const conf = {
    ...quickSetup("ts"),
    uiKit: "shadcn",
  };
  const out = await generate(conf, baseApp, projectPath);
  await check(conf, out);

  // Check shadcn specific files
  assert.ok(await exists(path.join(out, "components.json")), "components.json missing");
  const comp = JSON.parse(await fsp.readFile(path.join(out, "components.json"), "utf8"));
  assert.equal(comp.style, "new-york");
  assert.equal(comp.rsc, false);
  assert.equal(comp.tsx, true);
  assert.equal(comp.aliases.utils, "@/lib/utils");
  assert.equal(comp.aliases.ui, "@/shared/components/ui");
  assert.equal(
    comp.registries?.["@lumen"],
    "https://raw.githubusercontent.com/strophix-software/lumen-registry/main/public/r"
  );

  assert.ok(await exists(path.join(out, "src/lib/utils.ts")), "src/lib/utils.ts missing");
  assert.ok(await exists(path.join(out, "src/shared/components/ui/Button.tsx")), "Button.tsx missing");
  assert.ok(await exists(path.join(out, "src/shared/components/ui/Card.tsx")), "Card.tsx missing");
  assert.ok(await exists(path.join(out, "src/shared/components/ui/index.ts")), "index.ts missing");

  // Check manifest ui kit field
  const manifestRaw = JSON.parse(await fsp.readFile(path.join(out, "lumen.config.json"), "utf8"));
  assert.equal(manifestRaw.ui?.kit, "shadcn");

  // Check root tsconfig.json has paths alias
  const rootTsconfig = JSON.parse(await fsp.readFile(path.join(out, "tsconfig.json"), "utf8"));
  assert.ok(rootTsconfig.compilerOptions?.paths?.["@/*"], "root tsconfig missing @/* alias");

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js App Router scaffold with Jest does not emit babel.config.cjs (issue #65)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-app-jest");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-jest-app",
    framework: { name: "next", variant: "app-router" },
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "jest",
    bundler: "turbopack",
    adapter: "none",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };

  const provider = getProvider("next", "app-router");
  await scaffoldBase(projectPath, provider, "ts", TEMPLATES_DIR);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  // 1. Root cause verification: Next dev / Turbopack breaks if any babel config is present
  const babelCandidates = [
    "babel.config.cjs",
    "babel.config.js",
    "babel.config.mjs",
    "babel.config.json",
    ".babelrc",
    ".babelrc.json",
    ".babelrc.js",
    ".babelrc.cjs",
  ];
  for (const babelFile of babelCandidates) {
    assert.equal(
      await exists(path.join(projectPath, babelFile)),
      false,
      `Next.js project root must NOT contain ${babelFile} when Jest is selected (#65)`
    );
  }

  // 2. Next native jest config is emitted with next/jest wrapper
  assert.ok(await exists(path.join(projectPath, "jest.config.ts")), "jest.config.ts missing");
  const jestCfg = await fsp.readFile(path.join(projectPath, "jest.config.ts"), "utf8");
  assert.ok(jestCfg.includes('import nextJest from "next/jest.js";'), "must use Next's native next/jest wrapper");
  assert.ok(jestCfg.includes("createJestConfig"), "must export createJestConfig");
  assert.ok(jestCfg.includes("jest.setup.ts"), "must configure jest.setup.ts");

  // 3. Setup file exists
  assert.ok(await exists(path.join(projectPath, "jest.setup.ts")), "jest.setup.ts missing");

  // 4. Test file exists and tests App Router Home page
  assert.ok(await exists(path.join(projectPath, "src/__tests__/page.test.tsx")), "src/__tests__/page.test.tsx missing");
  assert.equal(await exists(path.join(projectPath, "src/__tests__/App.test.tsx")), false, "stray App.test.tsx should not exist");

  // 5. Scripts exist in package.json
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  assert.equal(pkgJson.scripts.test, "jest");
  assert.equal(pkgJson.scripts["test:watch"], "jest --watch");

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js Pages Router scaffold with Jest (js) emits jest.config.mjs without babel config (#65)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-pages-jest");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-pages-jest-app",
    framework: { name: "next", variant: "pages-router" },
    frameworkName: "next",
    frameworkVariant: "pages-router",
    architecture: "feature-based",
    language: "js",
    cssFramework: "tailwind",
    testing: "jest",
    bundler: "turbopack",
    adapter: "none",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };

  const provider = getProvider("next", "pages-router");
  await scaffoldBase(projectPath, provider, "js", TEMPLATES_DIR);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  assert.equal(await exists(path.join(projectPath, "babel.config.cjs")), false);
  assert.ok(await exists(path.join(projectPath, "jest.config.mjs")), "jest.config.mjs missing");
  const jestCfg = await fsp.readFile(path.join(projectPath, "jest.config.mjs"), "utf8");
  assert.ok(jestCfg.includes('import nextJest from "next/jest.js";'));
  assert.ok(await exists(path.join(projectPath, "jest.setup.js")), "jest.setup.js missing");
  assert.ok(await exists(path.join(projectPath, "src/__tests__/index.test.jsx")), "src/__tests__/index.test.jsx missing");

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js App Router scaffold with Prisma ORM (#62)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-prisma");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-prisma-app",
    framework: { name: "next", variant: "app-router" },
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    database: "prisma",
    bundler: "turbopack",
    adapter: "none",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    agentDocs: false,
  };

  const provider = getProvider("next", "app-router");
  await scaffoldBase(projectPath, provider, "ts", TEMPLATES_DIR);
  await copyEnvExample(projectPath, TEMPLATES_DIR, responses);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  // 1. Zero Babel
  assert.equal(await exists(path.join(projectPath, "babel.config.cjs")), false);
  assert.equal(await exists(path.join(projectPath, ".babelrc")), false);

  // 2. Prisma schema exists
  assert.ok(await exists(path.join(projectPath, "prisma/schema.prisma")), "prisma/schema.prisma missing");
  const schema = await fsp.readFile(path.join(projectPath, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes('provider  = "postgresql"'));
  assert.ok(schema.includes('directUrl = env("DIRECT_URL")'));

  // 3. Database client and seed files exist
  assert.ok(await exists(path.join(projectPath, "src/lib/db.ts")), "src/lib/db.ts missing");
  assert.ok(await exists(path.join(projectPath, "prisma/seed.ts")), "prisma/seed.ts missing");

  // 4. package.json scripts and seed configuration
  const pkgJson = JSON.parse(await fsp.readFile(path.join(projectPath, "package.json"), "utf8"));
  assert.equal(pkgJson.scripts["db:generate"], "prisma generate");
  assert.equal(pkgJson.scripts["db:push"], "prisma db push");
  assert.equal(pkgJson.scripts["db:seed"], "prisma db seed");
  assert.equal(pkgJson.scripts["db:studio"], "prisma studio");
  assert.equal(pkgJson.prisma?.seed, "tsx prisma/seed.ts");

  // 5. .env.example contains PostgreSQL / Supabase URLs
  const envContent = await fsp.readFile(path.join(projectPath, ".env.example"), "utf8");
  assert.ok(envContent.includes("DATABASE_URL="));
  assert.ok(envContent.includes("DIRECT_URL="));

  // 6. lumen.config.json validates with database config
  const manifest = parseManifest(JSON.parse(await fsp.readFile(path.join(projectPath, "lumen.config.json"), "utf8")));
  assert.equal(manifest.database?.orm, "prisma");
  assert.equal(manifest.database?.provider, "postgresql");

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js App Router scaffold with docker emits Dockerfile, compose, and standalone output (#63)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-docker");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-docker-app",
    framework: { name: "next", variant: "app-router" },
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "none",
    bundler: "turbopack",
    adapter: "none",
    docker: true,
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    agentDocs: false,
  };

  const provider = getProvider("next", "app-router");
  await scaffoldBase(projectPath, provider, "ts", TEMPLATES_DIR);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  // 1. Dockerfile exists with 4 stages
  assert.ok(await exists(path.join(projectPath, "Dockerfile")), "Dockerfile missing");
  const dockerfile = await fsp.readFile(path.join(projectPath, "Dockerfile"), "utf8");
  assert.ok(dockerfile.includes("FROM node:22-alpine AS base") || dockerfile.includes("FROM node:20-alpine AS base"));
  assert.ok(dockerfile.includes("AS deps"));
  assert.ok(dockerfile.includes("AS builder"));
  assert.ok(dockerfile.includes("AS runner"));
  assert.ok(dockerfile.includes(".next/standalone"));

  // 2. .dockerignore exists
  assert.ok(await exists(path.join(projectPath, ".dockerignore")), ".dockerignore missing");
  const dockerignore = await fsp.readFile(path.join(projectPath, ".dockerignore"), "utf8");
  assert.ok(dockerignore.includes("node_modules"));
  assert.ok(dockerignore.includes(".next"));

  // 3. docker-compose.yml exists with app and postgres
  assert.ok(await exists(path.join(projectPath, "docker-compose.yml")), "docker-compose.yml missing");
  const compose = await fsp.readFile(path.join(projectPath, "docker-compose.yml"), "utf8");
  assert.ok(compose.includes("app:"));
  assert.ok(compose.includes("db:"));
  assert.ok(compose.includes("postgres:16-alpine"));

  // 4. next.config.ts has output: "standalone"
  assert.ok(await exists(path.join(projectPath, "next.config.ts")), "next.config.ts missing");
  const nextCfg = await fsp.readFile(path.join(projectPath, "next.config.ts"), "utf8");
  assert.ok(nextCfg.includes('output: "standalone"'));

  // 5. manifest v2 contains docker: true
  const manifestRaw = JSON.parse(await fsp.readFile(path.join(projectPath, "lumen.config.json"), "utf8"));
  assert.equal(manifestRaw.docker, true);

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js App Router scaffold with routeGroups preset and auth proxy (#64)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-route-groups");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-route-groups-app",
    framework: { name: "next", variant: "app-router" },
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    bundler: "turbopack",
    adapter: "none",
    routeGroups: true,
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };

  const provider = getProvider("next", "app-router");
  await scaffoldBase(projectPath, provider, "ts", TEMPLATES_DIR);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  // 1. Colliding root page MUST NOT exist
  assert.equal(await exists(path.join(projectPath, "src/app/page.tsx")), false, "src/app/page.tsx must not exist");
  assert.equal(await exists(path.join(projectPath, "src/app/page.jsx")), false, "src/app/page.jsx must not exist");

  // 2. Route groups directories and landing page
  assert.ok(await exists(path.join(projectPath, "src/app/(public)/layout.tsx")), "(public)/layout.tsx missing");
  assert.ok(await exists(path.join(projectPath, "src/app/(public)/page.tsx")), "(public)/page.tsx missing");
  assert.ok(await exists(path.join(projectPath, "src/app/(auth)/layout.tsx")), "(auth)/layout.tsx missing");
  assert.ok(await exists(path.join(projectPath, "src/app/(private)/layout.tsx")), "(private)/layout.tsx missing");
  assert.ok(await exists(path.join(projectPath, "src/app/(admin)/layout.tsx")), "(admin)/layout.tsx missing");

  // 3. Auth proxy middleware exists
  assert.ok(await exists(path.join(projectPath, "src/middleware.ts")), "middleware.ts missing");

  // 4. Manifest emitted has routeGroups: true
  const manifestRaw = await fsp.readFile(path.join(projectPath, "lumen.config.json"), "utf8");
  const parsed = parseManifest(JSON.parse(manifestRaw));
  assert.equal(parsed.routeGroups, true);

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: Next.js App Router scaffold with Vitest, Axios, and cleanup cleans provenance (#66)", async () => {
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-next-app-vitest-axios");
  await fsp.rm(projectPath, { recursive: true, force: true });
  await fsp.mkdir(projectPath, { recursive: true });

  const responses = {
    projectName: "next-vitest-axios-app",
    framework: { name: "next", variant: "app-router" },
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    apiClient: "axios",
    bundler: "turbopack",
    adapter: "none",
    linter: "eslint",
    formatter: "prettier",
    gitInit: false,
    readme: true,
  };

  const provider = getProvider("next", "app-router");
  await scaffoldBase(projectPath, provider, "ts", TEMPLATES_DIR);
  await injectConditionals(projectPath, TEMPLATES_DIR, responses, responses.architecture, responses.language);
  await injectFormatter(projectPath, TEMPLATES_DIR, responses);
  await cleanupBoilerplate(projectPath);
  await copyEnvExample(projectPath, TEMPLATES_DIR, responses);
  await emitManifest(projectPath, responses);

  // 1. .provenance.json must be cleaned up
  assert.equal(
    await exists(path.join(projectPath, ".provenance.json")),
    false,
    ".provenance.json must be cleaned up by cleanupBoilerplate"
  );

  // 2. Vitest config exists without @vitejs/plugin-react
  assert.ok(await exists(path.join(projectPath, "vitest.config.ts")), "vitest.config.ts missing");
  const vitestCfg = await fsp.readFile(path.join(projectPath, "vitest.config.ts"), "utf8");
  assert.equal(
    vitestCfg.includes("@vitejs/plugin-react"),
    false,
    "Next.js vitest.config.ts must not contain @vitejs/plugin-react"
  );
  assert.ok(vitestCfg.includes("globals: true"));

  // 3. Router-aware test page.test.tsx exists and App.test.tsx does not
  assert.ok(await exists(path.join(projectPath, "src/__tests__/page.test.tsx")), "page.test.tsx missing");
  assert.equal(await exists(path.join(projectPath, "src/__tests__/App.test.tsx")), false, "App.test.tsx should not exist");

  // 4. Axios config uses process.env.NEXT_PUBLIC_API_URL
  const axiosCfgPath = path.join(projectPath, "src/shared/lib/axios/api.config.ts");
  assert.ok(await exists(axiosCfgPath), "axios api.config.ts missing");
  const axiosCfg = await fsp.readFile(axiosCfgPath, "utf8");
  assert.ok(axiosCfg.includes("process.env.NEXT_PUBLIC_API_URL"), "must use NEXT_PUBLIC_API_URL");
  assert.equal(axiosCfg.includes("import.meta.env"), false, "must not contain import.meta.env");

  // 5. .env.example contains NEXT_PUBLIC_API_URL
  assert.ok(await exists(path.join(projectPath, ".env.example")), ".env.example missing");
  const envContent = await fsp.readFile(path.join(projectPath, ".env.example"), "utf8");
  assert.ok(envContent.includes("NEXT_PUBLIC_API_URL=https://api.example.com"));

  await fsp.rm(projectPath, { recursive: true, force: true });
});

test("offline smoke: agentDocs emits root AGENTS.md referencing lumen.config.json and no .lumen/ directory (#67)", async () => {
  const baseApp = await ensureBase("ts");
  const projectPath = path.join(os.tmpdir(), "lumen-smoke-agents-md");
  const conf = {
    ...quickSetup("ts"),
    agentDocs: true,
  };
  const out = await generate(conf, baseApp, projectPath);
  await emitAgentContext(out, conf);

  assert.ok(await exists(path.join(out, "AGENTS.md")), "AGENTS.md must exist at root");
  assert.equal(await exists(path.join(out, ".lumen")), false, ".lumen/ directory must not exist");

  const content = await fsp.readFile(path.join(out, "AGENTS.md"), "utf8");
  assert.ok(content.includes("Single Source of Truth (SSOT)"));
  assert.ok(content.includes("Component Taxonomy"));
  assert.ok(content.includes("lumen.config.json"));

  await fsp.rm(projectPath, { recursive: true, force: true });
});

