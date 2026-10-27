import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { promises as fsp } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReadme, generateReadme, isNextFramework } from "../../src/readme.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

test("readme: isNextFramework correctly identifies Next.js configurations", () => {
  assert.equal(isNextFramework({ framework: { name: "next", variant: "app-router" } }), true);
  assert.equal(isNextFramework({ frameworkName: "next", frameworkVariant: "pages-router" }), true);
  assert.equal(isNextFramework({ framework: { name: "react", variant: "vite" } }), false);
  assert.equal(isNextFramework({ frameworkName: "react", frameworkVariant: "vite" }), false);
});

test("readme: next-ts README documents Next.js 16, Turbopack, and does NOT mention Vite (#74)", () => {
  const responses = {
    framework: { name: "next", variant: "app-router" },
    language: "ts",
    architecture: "feature-based",
    bundler: "turbopack",
    cssFramework: "tailwind",
    uiKit: "none",
    routeGroups: false,
    testing: "vitest",
    linter: "eslint",
    formatter: "prettier",
  };

  const readme = buildReadme("my-next-app", responses, TEMPLATES_DIR);

  // Framework-specific assertions
  assert.ok(readme.includes("Next.js 16 (App Router + Turbopack)"), "README should document Next.js 16 Turbopack");
  assert.ok(readme.includes("npm run start"), "Next.js scripts must include 'npm run start'");
  assert.ok(readme.includes("npm run build"), "Next.js scripts must include 'npm run build'");
  assert.ok(readme.includes("npm run typecheck"), "TypeScript scripts must include 'npm run typecheck'");

  // No Vite contamination
  assert.equal(readme.includes("React + Vite"), false, "Next.js README must not mention 'React + Vite'");
  assert.equal(readme.includes("npm run preview"), false, "Next.js README must not mention 'npm run preview'");
  assert.equal(readme.includes("vitejs.dev"), false, "Next.js README must not link to vitejs.dev");
});

test("readme: next-ts with routeGroups documents Route Groups and Next.js 16 Proxy specification (#74)", () => {
  const responses = {
    framework: { name: "next", variant: "app-router" },
    language: "ts",
    architecture: "feature-based",
    bundler: "turbopack",
    cssFramework: "tailwind",
    uiKit: "none",
    routeGroups: true,
    testing: "none",
    linter: "eslint",
    formatter: "prettier",
  };

  const readme = buildReadme("secure-next-app", responses, TEMPLATES_DIR);

  assert.ok(readme.includes("Route Groups & Edge Auth Proxy"), "README should include Route Groups section");
  assert.ok(readme.includes("Next.js 16 Proxy specification"), "README should reference Next.js 16 Proxy specification");
  assert.ok(readme.includes("src/proxy.ts"), "README should reference src/proxy.ts");
  assert.ok(readme.includes("(public)"), "README should describe (public) route group");
  assert.ok(readme.includes("(auth)"), "README should describe (auth) route group");
  assert.ok(readme.includes("(private)"), "README should describe (private) route group");
  assert.ok(readme.includes("(admin)"), "README should describe (admin) route group");
});

test("readme: vite-ts README documents React + Vite baseline (#74)", () => {
  const responses = {
    framework: { name: "react", variant: "vite" },
    language: "ts",
    architecture: "feature-based",
    cssFramework: "tailwind",
    uiKit: "none",
    testing: "vitest",
    linter: "eslint",
    formatter: "prettier",
  };

  const readme = buildReadme("my-vite-app", responses, TEMPLATES_DIR);

  assert.ok(readme.includes("React + Vite"), "Vite README should document React + Vite");
  assert.ok(readme.includes("npm run preview"), "Vite scripts must include 'npm run preview'");
  assert.equal(readme.includes("Next.js 16"), false, "Vite README must not mention Next.js");
  assert.equal(readme.includes("Turbopack"), false, "Vite README must not mention Turbopack");
  assert.equal(readme.includes("src/proxy.ts"), false, "Vite README must not mention Next proxy");
});

test("readme: database prisma adds Prisma ORM and seed commands (#74, #75)", () => {
  const responses = {
    framework: { name: "next", variant: "app-router" },
    language: "ts",
    architecture: "feature-based",
    database: "prisma",
    databaseProvider: "postgresql",
    linter: "eslint",
    formatter: "prettier",
  };

  const readme = buildReadme("prisma-app", responses, TEMPLATES_DIR);

  assert.ok(readme.includes("Prisma ORM"), "README should list Prisma ORM in Built With");
  assert.ok(readme.includes("npm run db:generate"), "README should list db:generate");
  assert.ok(readme.includes("npm run db:push"), "README should list db:push");
  assert.ok(readme.includes("npm run db:seed"), "README should list db:seed");
  assert.ok(readme.includes("npm run db:studio"), "README should list db:studio");
});

test("readme: generateReadme creates README.md and LICENSE on disk", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-readme-test-"));
  try {
    const responses = {
      framework: { name: "next", variant: "app-router" },
      language: "ts",
      architecture: "feature-based",
      linter: "eslint",
      formatter: "prettier",
    };

    await generateReadme(dir, "disk-readme-app", responses, TEMPLATES_DIR);

    const readmeContent = await fsp.readFile(path.join(dir, "README.md"), "utf8");
    assert.ok(readmeContent.includes("# disk-readme-app"));
    assert.ok(readmeContent.includes("Next.js 16 (App Router + Turbopack)"));

    const licenseContent = await fsp.readFile(path.join(dir, "LICENSE"), "utf8");
    assert.ok(licenseContent.includes("MIT License"));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
