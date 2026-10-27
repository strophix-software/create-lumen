import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  FRAGMENT_SCOPES,
  FRAGMENT_PRECEDENCE,
  TOOLING_ORDER,
  resolveFragments,
  sortFragments,
  applyFragments,
  langFileFilter,
  pruneRedundantGitkeeps,
} from "../../src/engine/composition.js";
import {
  injectArchitecture,
  injectConditionals,
  injectFormatter,
  injectComposedFragments,
} from "../../src/injector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

async function diffTrees(a, b) {
  const getFiles = async (dir, rel = "") => {
    const res = {};
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return res;
    }
    for (const entry of entries) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        Object.assign(res, await getFiles(fullPath, nextRel));
      } else if (entry.isFile()) {
        res[nextRel] = await fsp.readFile(fullPath);
      }
    }
    return res;
  };

  const filesA = await getFiles(a);
  const filesB = await getFiles(b);

  const allKeys = Array.from(new Set([...Object.keys(filesA), ...Object.keys(filesB)])).sort();
  for (const k of allKeys) {
    if (!filesA[k]) return `file missing in A: ${k}`;
    if (!filesB[k]) return `file missing in B: ${k}`;
    if (!filesA[k].equals(filesB[k])) return `content mismatch: ${k}`;
  }
  return null;
}

test("composition: documented precedence order is strictly maintained", () => {
  assert.deepEqual(FRAGMENT_PRECEDENCE, [
    FRAGMENT_SCOPES.BASE,
    FRAGMENT_SCOPES.FRAMEWORK,
    FRAGMENT_SCOPES.ARCH,
    FRAGMENT_SCOPES.STYLING,
    FRAGMENT_SCOPES.TOOLING,
  ]);
});

test("composition: resolveFragments produces sorted fragments in precedence order for React/Vite", () => {
  const responses = {
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    router: true,
    stateManagement: "redux",
    iconLibrary: "lucide",
    apiClient: "axios",
    testing: "vitest",
    linter: "eslint",
    formatter: "prettier",
  };

  const fragments = resolveFragments(responses, TEMPLATES_DIR);
  assert.ok(fragments.length > 0);

  // Verify non-decreasing scope precedence
  let lastScopeIdx = -1;
  for (const f of fragments) {
    const currentScopeIdx = FRAGMENT_PRECEDENCE.indexOf(f.scope);
    assert.ok(
      currentScopeIdx >= lastScopeIdx,
      `Fragment ${f.id} scope (${f.scope}) violates precedence order`
    );
    lastScopeIdx = currentScopeIdx;
  }

  // Verify tooling sub-order
  const toolingFragments = fragments.filter((f) => f.scope === FRAGMENT_SCOPES.TOOLING);
  let lastToolingIdx = -1;
  for (const f of toolingFragments) {
    if (f.category) {
      const catIdx = TOOLING_ORDER.indexOf(f.category);
      assert.ok(
        catIdx >= lastToolingIdx,
        `Tooling category ${f.category} violates tooling order`
      );
      lastToolingIdx = catIdx;
    }
  }
});

test("composition: Next.js App Router omits client router fragment via capabilities without special casing", () => {
  const responses = {
    frameworkName: "next",
    frameworkVariant: "app-router",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    router: true, // Requested, but Next has FILESYSTEM_ROUTING and lacks CLIENT_ROUTING
    testing: "vitest",
    linter: "eslint",
  };

  const fragments = resolveFragments(responses, TEMPLATES_DIR);
  const routerFragments = fragments.filter((f) => f.category === "router");
  assert.equal(
    routerFragments.length,
    0,
    "Router fragment must be excluded for Next.js via capabilities"
  );
});

test("composition: langFileFilter isolates TypeScript and JavaScript files", () => {
  const tsFilter = langFileFilter("ts");
  assert.equal(tsFilter("App.tsx"), true);
  assert.equal(tsFilter("main.ts"), true);
  assert.equal(tsFilter("App.jsx"), false);
  assert.equal(tsFilter("main.js"), false);
  assert.equal(tsFilter(".gitignore"), true);

  const jsFilter = langFileFilter("js");
  assert.equal(jsFilter("App.jsx"), true);
  assert.equal(jsFilter("main.js"), true);
  assert.equal(jsFilter("App.tsx"), false);
  assert.equal(jsFilter("main.ts"), false);
  assert.equal(jsFilter(".gitignore"), true);
});

test("composition: pruneRedundantGitkeeps removes .gitkeep only when sibling real files exist", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-gitkeep-"));
  try {
    const emptyFolder = path.join(dir, "src", "empty");
    const activeFolder = path.join(dir, "src", "active");
    await fsp.mkdir(emptyFolder, { recursive: true });
    await fsp.mkdir(activeFolder, { recursive: true });

    await fsp.writeFile(path.join(emptyFolder, ".gitkeep"), "");
    await fsp.writeFile(path.join(activeFolder, ".gitkeep"), "");
    await fsp.writeFile(path.join(activeFolder, "index.ts"), "export {}");

    await pruneRedundantGitkeeps(dir);

    // emptyFolder keeps .gitkeep
    assert.ok(
      await fsp.stat(path.join(emptyFolder, ".gitkeep")).catch(() => false),
      "empty folder should keep .gitkeep"
    );
    // activeFolder loses .gitkeep
    assert.ok(
      !(await fsp.stat(path.join(activeFolder, ".gitkeep")).catch(() => false)),
      "active folder should have .gitkeep removed"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: injectComposedFragments achieves byte-identical determinism on consecutive runs", async () => {
  const dir1 = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-det-1-"));
  const dir2 = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-det-2-"));

  try {
    const responses = {
      frameworkName: "react",
      frameworkVariant: "vite",
      architecture: "feature-based",
      language: "ts",
      cssFramework: "tailwind",
      router: true,
      stateManagement: "redux",
      iconLibrary: "lucide",
      apiClient: "axios",
      testing: "vitest",
      linter: "eslint",
      formatter: "prettier",
    };

    // Prepare matching base structure in both
    for (const dir of [dir1, dir2]) {
      await fsp.mkdir(path.join(dir, "src"), { recursive: true });
      await fsp.writeFile(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "app", scripts: {} }, null, 2)
      );
      await fsp.writeFile(
        path.join(dir, "eslint.config.ts"),
        "export default tseslint.config(\n  { ignores: ['dist'] }\n);"
      );
    }

    await injectComposedFragments(dir1, TEMPLATES_DIR, responses);
    await injectComposedFragments(dir2, TEMPLATES_DIR, responses);

    const diff = await diffTrees(dir1, dir2);
    assert.equal(diff, null, `Determinism failure: ${diff}`);
  } finally {
    await fsp.rm(dir1, { recursive: true, force: true });
    await fsp.rm(dir2, { recursive: true, force: true });
  }
});

test("composition: Biome linter fragment emits biome.json and scripts", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-biome-test-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );
    const responses = {
      frameworkName: "react",
      frameworkVariant: "vite",
      architecture: "feature-based",
      language: "ts",
      linter: "biome",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const biomeFrag = fragments.find((f) => f.id === "tooling:linter:biome");
    assert.ok(biomeFrag, "Biome fragment should be present");
    assert.equal(biomeFrag.scripts.lint, "biome check .");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });
    const hasBiomeJson = await fsp.stat(path.join(dir, "biome.json")).catch(() => false);
    assert.ok(hasBiomeJson, "biome.json should exist in project");

    const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.scripts.lint, "biome check .");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js adapter overlay and turbopack dev script", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-adapter-test-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );
    // Initial next.config.ts
    await fsp.writeFile(path.join(dir, "next.config.ts"), "const nextConfig = {};\nexport default nextConfig;");

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      bundler: "turbopack",
      adapter: "node",
      reactCompiler: true,
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const nextConfigFrag = fragments.find((f) => f.id === "tooling:next:config");
    assert.ok(nextConfigFrag, "Next config fragment should be present");
    assert.equal(nextConfigFrag.scripts.dev, "next dev --turbopack");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.scripts.dev, "next dev --turbopack");

    const nextConfigContent = await fsp.readFile(path.join(dir, "next.config.ts"), "utf8");
    assert.ok(nextConfigContent.includes("standalone"), "Node adapter sets output standalone");
    assert.ok(nextConfigContent.includes("reactCompiler"), "React Compiler flag injected");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js App Router with Jest emits native next/jest config and never babel.config.cjs (#65)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-jest-app-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      testing: "jest",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const jestFrag = fragments.find((f) => f.id === "tooling:testing:jest");
    assert.ok(jestFrag, "Jest testing fragment should be present");
    assert.equal(jestFrag.scripts.test, "jest");
    assert.equal(jestFrag.scripts["test:watch"], "jest --watch");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // 1. babel.config.cjs MUST NOT exist (#65)
    assert.equal(
      await fsp.stat(path.join(dir, "babel.config.cjs")).catch(() => false),
      false,
      "babel.config.cjs must never be emitted for Next.js"
    );

    // 2. jest.config.ts must exist and use next/jest wrapper
    const jestConfigContent = await fsp.readFile(path.join(dir, "jest.config.ts"), "utf8");
    assert.ok(jestConfigContent.includes('import nextJest from "next/jest.js";'), "must import next/jest.js");
    assert.ok(jestConfigContent.includes("createJestConfig"), "must wrap config with createJestConfig");
    assert.ok(jestConfigContent.includes("jest.setup.ts"), "must reference jest.setup.ts");

    // 3. jest.setup.ts must exist
    assert.ok(await fsp.stat(path.join(dir, "jest.setup.ts")).catch(() => false));

    // 4. App Router test file must test Home component
    const testContent = await fsp.readFile(path.join(dir, "src", "__tests__", "page.test.tsx"), "utf8");
    assert.ok(testContent.includes('@/app/page'), "must test @/app/page");
    assert.equal(
      await fsp.stat(path.join(dir, "src", "__tests__", "App.test.tsx")).catch(() => false),
      false,
      "App.test.tsx must not be emitted for Next.js"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js Pages Router with Jest (JS) emits jest.config.mjs and never babel.config.cjs (#65)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-jest-pages-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "pages-router",
      architecture: "feature-based",
      language: "js",
      testing: "jest",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "js" });

    // 1. babel.config.cjs MUST NOT exist
    assert.equal(
      await fsp.stat(path.join(dir, "babel.config.cjs")).catch(() => false),
      false,
      "babel.config.cjs must never be emitted for Next.js"
    );

    // 2. jest.config.mjs must exist
    const jestConfigContent = await fsp.readFile(path.join(dir, "jest.config.mjs"), "utf8");
    assert.ok(jestConfigContent.includes('import nextJest from "next/jest.js";'));
    assert.ok(jestConfigContent.includes("jest.setup.js"));

    // 3. jest.setup.js must exist
    assert.ok(await fsp.stat(path.join(dir, "jest.setup.js")).catch(() => false));

    // 4. Pages Router test file must test Home component at @/pages/index
    const testContent = await fsp.readFile(path.join(dir, "src", "__tests__", "index.test.jsx"), "utf8");
    assert.ok(testContent.includes('@/pages/index'));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: React/Vite with Jest still emits babel.config.cjs and standard jest.config.ts", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-react-jest-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "react",
      frameworkVariant: "vite",
      architecture: "feature-based",
      language: "ts",
      testing: "jest",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // React/Vite DOES emit babel.config.cjs
    assert.ok(await fsp.stat(path.join(dir, "babel.config.cjs")).catch(() => false));
    const jestConfigContent = await fsp.readFile(path.join(dir, "jest.config.ts"), "utf8");
    assert.ok(jestConfigContent.includes("babel-jest"));
    assert.ok(await fsp.stat(path.join(dir, "src", "__tests__", "App.test.tsx")).catch(() => false));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with Prisma ORM scaffolds schema, client, seed, scripts, and env", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-prisma-ts-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "next-prisma-app", scripts: {} }, null, 2)
    );
    await fsp.writeFile(
      path.join(dir, ".env.example"),
      "VITE_API_URL=https://api.example.com\n"
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      database: "prisma",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const dbFrag = fragments.find((f) => f.id === "tooling:database:prisma");
    assert.ok(dbFrag, "database fragment must be resolved");
    assert.equal(dbFrag.category, "database");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // 1. prisma/schema.prisma exists and contains postgresql provider + directUrl
    const schemaContent = await fsp.readFile(path.join(dir, "prisma", "schema.prisma"), "utf8");
    assert.ok(schemaContent.includes('provider  = "postgresql"'));
    assert.ok(schemaContent.includes('url       = env("DATABASE_URL")'));
    assert.ok(schemaContent.includes('directUrl = env("DIRECT_URL")'));

    // 2. src/lib/db.ts exists and caches globalThis.prisma
    const dbClientContent = await fsp.readFile(path.join(dir, "src", "lib", "db.ts"), "utf8");
    assert.ok(dbClientContent.includes("globalForPrisma"));
    assert.ok(dbClientContent.includes("new PrismaClient"));

    // 3. prisma/seed.ts exists
    assert.ok(await fsp.stat(path.join(dir, "prisma", "seed.ts")).catch(() => false));

    // 4. package.json scripts and seed config
    const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.scripts["db:generate"], "prisma generate");
    assert.equal(pkg.scripts["db:push"], "prisma db push");
    assert.equal(pkg.scripts["db:seed"], "prisma db seed");
    assert.equal(pkg.scripts["db:studio"], "prisma studio");
    assert.equal(pkg.prisma, undefined, "package.json should not contain deprecated prisma key (#75)");

    // 4b. prisma.config.ts exists and specifies defineConfig with earlyAccess and seed (#75)
    assert.ok(await fsp.stat(path.join(dir, "prisma.config.ts")).catch(() => false));
    const prismaConfig = await fsp.readFile(path.join(dir, "prisma.config.ts"), "utf8");
    assert.ok(prismaConfig.includes("defineConfig"));
    assert.ok(prismaConfig.includes("earlyAccess: true"));
    assert.ok(prismaConfig.includes('seed: "tsx prisma/seed.ts"'));

    // 5. .env.example contains DATABASE_URL and DIRECT_URL
    const envContent = await fsp.readFile(path.join(dir, ".env.example"), "utf8");
    assert.ok(envContent.includes("DATABASE_URL="));
    assert.ok(envContent.includes("DIRECT_URL="));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with Prisma ORM in JS scaffolds db.js and seed.js", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-prisma-js-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "next-prisma-js-app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "pages-router",
      architecture: "feature-based",
      language: "js",
      database: "prisma",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "js" });

    assert.ok(await fsp.stat(path.join(dir, "prisma", "seed.js")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "lib", "db.js")).catch(() => false));

    const pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.prisma, undefined, "package.json should not contain deprecated prisma key (#75)");

    assert.ok(await fsp.stat(path.join(dir, "prisma.config.js")).catch(() => false));
    const prismaConfig = await fsp.readFile(path.join(dir, "prisma.config.js"), "utf8");
    assert.ok(prismaConfig.includes("defineConfig"));
    assert.ok(prismaConfig.includes("earlyAccess: true"));
    assert.ok(prismaConfig.includes('seed: "node prisma/seed.js"'));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with docker emits Dockerfile, .dockerignore, docker-compose.yml and standalone next.config", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-docker-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      bundler: "turbopack",
      architecture: "feature-based",
      language: "ts",
      docker: true,
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const dockerFrag = fragments.find((f) => f.id === "tooling:docker");
    assert.ok(dockerFrag, "tooling:docker fragment should be present");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // 1. Dockerfile exists and has 4 stages
    assert.ok(await fsp.stat(path.join(dir, "Dockerfile")).catch(() => false));
    const dockerfileContent = await fsp.readFile(path.join(dir, "Dockerfile"), "utf8");
    assert.ok(dockerfileContent.includes("AS base"));
    assert.ok(dockerfileContent.includes("AS deps"));
    assert.ok(dockerfileContent.includes("AS builder"));
    assert.ok(dockerfileContent.includes("AS runner"));
    assert.ok(dockerfileContent.includes("node:22-alpine") || dockerfileContent.includes("node:20-alpine"));
    assert.ok(dockerfileContent.includes(".next/standalone"));

    // 2. .dockerignore exists and ignores essential files
    assert.ok(await fsp.stat(path.join(dir, ".dockerignore")).catch(() => false));
    const dockerignoreContent = await fsp.readFile(path.join(dir, ".dockerignore"), "utf8");
    assert.ok(dockerignoreContent.includes("node_modules"));
    assert.ok(dockerignoreContent.includes(".next"));

    // 3. docker-compose.yml exists and defines app + db
    assert.ok(await fsp.stat(path.join(dir, "docker-compose.yml")).catch(() => false));
    const composeContent = await fsp.readFile(path.join(dir, "docker-compose.yml"), "utf8");
    assert.ok(composeContent.includes("app:"));
    assert.ok(composeContent.includes("db:"));
    assert.ok(composeContent.includes("postgres:16-alpine"));
    assert.ok(composeContent.includes("3000:3000"));

    // 4. next.config.ts has output: "standalone"
    assert.ok(await fsp.stat(path.join(dir, "next.config.ts")).catch(() => false));
    const nextCfgContent = await fsp.readFile(path.join(dir, "next.config.ts"), "utf8");
    assert.ok(nextCfgContent.includes('output: "standalone"'));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js App Router with routeGroups emits route group layouts, proxy middleware and cleans up colliding root page (ts)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-routegroups-ts-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      routeGroups: true,
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // 1. Colliding root page MUST NOT exist
    assert.equal(
      await fsp.stat(path.join(dir, "src", "app", "page.tsx")).catch(() => false),
      false,
      "src/app/page.tsx must be removed to avoid route collision with (public)/page.tsx"
    );
    assert.equal(
      await fsp.stat(path.join(dir, "src", "app", "page.jsx")).catch(() => false),
      false
    );

    // 2. Route groups directories and files must exist
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(public)", "layout.tsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(public)", "page.tsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(auth)", "layout.tsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(private)", "layout.tsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(admin)", "layout.tsx")).catch(() => false));

    // 3. Auth proxy must exist as proxy.ts and export proxy and config matcher; middleware.ts must not exist (#70)
    const proxyPath = path.join(dir, "src", "proxy.ts");
    assert.ok(await fsp.stat(proxyPath).catch(() => false), "src/proxy.ts must exist");
    const proxyContent = await fsp.readFile(proxyPath, "utf8");
    assert.ok(proxyContent.includes("export function proxy"));
    assert.ok(proxyContent.includes("auth-token"));
    assert.ok(proxyContent.includes("userRole"));
    assert.ok(proxyContent.includes("export const config"));

    const middlewarePath = path.join(dir, "src", "middleware.ts");
    assert.equal(
      await fsp.stat(middlewarePath).catch(() => false),
      false,
      "src/middleware.ts must not exist when proxy.ts is present (#70)"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js App Router with Route Groups and Vitest rewrites test import to @/app/(public)/page", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-rg-vitest-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      routeGroups: true,
      testing: "vitest",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    const testPath = path.join(dir, "src", "__tests__", "page.test.tsx");
    assert.ok(await fsp.stat(testPath).catch(() => false), "page.test.tsx must exist");
    const testContent = await fsp.readFile(testPath, "utf8");
    assert.ok(
      testContent.includes("@/app/(public)/page"),
      "must import @/app/(public)/page when routeGroups is enabled"
    );
    assert.equal(
      testContent.includes("@/app/page"),
      false,
      "must not retain @/app/page import"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with Vitest emits clean vitest.config without @vitejs/plugin-react (#66)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-vitest-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      testing: "vitest",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    const vitestFrag = fragments.find((f) => f.id === "tooling:testing:vitest");
    assert.ok(vitestFrag, "Vitest fragment present");
    assert.equal(vitestFrag.scripts.test, "vitest");
    assert.equal(vitestFrag.scripts["test:run"], "vitest run");

    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // 1. vitest.config.ts must not contain @vitejs/plugin-react
    const vitestCfg = await fsp.readFile(path.join(dir, "vitest.config.ts"), "utf8");
    assert.ok(!vitestCfg.includes("@vitejs/plugin-react"), "must not include @vitejs/plugin-react");
    assert.ok(vitestCfg.includes("globals: true"));
    assert.ok(vitestCfg.includes("setup.ts"));

    // 2. Router-aware test file page.test.tsx must exist; App.test.tsx must not
    assert.ok(await fsp.stat(path.join(dir, "src", "__tests__", "page.test.tsx")).catch(() => false));
    assert.equal(
      await fsp.stat(path.join(dir, "src", "__tests__", "App.test.tsx")).catch(() => false),
      false,
      "App.test.tsx must not exist for Next.js App Router"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js App Router with routeGroups emits route group layouts and middleware (js)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-routegroups-js-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "js",
      routeGroups: true,
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "js" });

    // 1. Colliding root page MUST NOT exist
    assert.equal(
      await fsp.stat(path.join(dir, "src", "app", "page.js")).catch(() => false),
      false,
      "src/app/page.js must be removed"
    );

    // 2. Route groups directories and files must exist
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(public)", "layout.jsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(public)", "page.jsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(auth)", "layout.jsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(private)", "layout.jsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "(admin)", "layout.jsx")).catch(() => false));

    // 3. Auth proxy in js must exist as proxy.js; middleware.js must not exist (#70)
    const proxyPath = path.join(dir, "src", "proxy.js");
    assert.ok(await fsp.stat(proxyPath).catch(() => false), "src/proxy.js must exist");
    const proxyContent = await fsp.readFile(proxyPath, "utf8");
    assert.ok(proxyContent.includes("export function proxy"));

    const middlewarePath = path.join(dir, "src", "middleware.js");
    assert.equal(
      await fsp.stat(middlewarePath).catch(() => false),
      false,
      "src/middleware.js must not exist when proxy.js is present (#70)"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with Axios/Fetch adapts env var to NEXT_PUBLIC_API_URL (#66)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-api-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      apiClient: "axios",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    const cfgPath = path.join(dir, "src", "shared", "lib", "axios", "api.config.ts");
    assert.ok(await fsp.stat(cfgPath).catch(() => false), "api.config.ts should exist");
    const cfg = await fsp.readFile(cfgPath, "utf8");
    assert.ok(cfg.includes("process.env.NEXT_PUBLIC_API_URL"), "must use process.env.NEXT_PUBLIC_API_URL");
    assert.ok(!cfg.includes("import.meta.env.VITE_API_URL"), "must not use import.meta.env.VITE_API_URL");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js with Redux applies without touching main.tsx (#66)", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-redux-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      stateManagement: "redux",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    assert.equal(
      await fsp.stat(path.join(dir, "src", "main.tsx")).catch(() => false),
      false,
      "main.tsx must not be created or touched for Next.js"
    );
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js App Router does not pollute src/app with React App layer files", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-arch-clean-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "app-router",
      architecture: "feature-based",
      language: "ts",
      cssFramework: "tailwind",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // App Router route files must exist
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "layout.tsx")).catch(() => false));
    assert.ok(await fsp.stat(path.join(dir, "src", "app", "page.tsx")).catch(() => false));

    // React/Vite-specific application layer files must NOT exist inside src/app
    assert.equal(await fsp.stat(path.join(dir, "src", "app", "App.tsx")).catch(() => false), false);
    assert.equal(await fsp.stat(path.join(dir, "src", "app", "hooks")).catch(() => false), false);
    assert.equal(await fsp.stat(path.join(dir, "src", "app", "contexts")).catch(() => false), false);
    assert.equal(await fsp.stat(path.join(dir, "src", "app", "providers")).catch(() => false), false);

    // Shared hooks must exist under src/shared/hooks (Single Source of Hooks)
    assert.ok(await fsp.stat(path.join(dir, "src", "shared", "hooks", "useLocalStorage.ts")).catch(() => false));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("composition: Next.js Pages Router does not emit src/app directory", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-next-pages-clean-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "app", scripts: {} }, null, 2)
    );

    const responses = {
      frameworkName: "next",
      frameworkVariant: "pages-router",
      architecture: "feature-based",
      language: "ts",
      cssFramework: "tailwind",
    };
    const fragments = resolveFragments(responses, TEMPLATES_DIR);
    await applyFragments(dir, fragments, { templatesDir: TEMPLATES_DIR, responses, language: "ts" });

    // Pages Router must have src/pages
    assert.ok(await fsp.stat(path.join(dir, "src", "pages", "index.tsx")).catch(() => false));

    // src/app must not exist in Pages Router
    assert.equal(await fsp.stat(path.join(dir, "src", "app")).catch(() => false), false);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
