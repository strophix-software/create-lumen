import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { promises as fsp } from "node:fs";
import { fileURLToPath } from "node:url";
import { copyEnvExample, buildEnvExample, resolveFramework } from "../../src/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

test("env: buildEnvExample generates Vite baseline for React", () => {
  const content = buildEnvExample({
    framework: { name: "react", variant: "vite" },
  });

  assert.ok(content.includes("VITE_API_URL=https://api.example.com"));
  assert.ok(content.includes("https://vite.dev/guide/env-and-mode"));
  assert.equal(content.includes("NEXT_PUBLIC_"), false);
  assert.equal(content.includes("DATABASE_URL"), false);
});

test("env: buildEnvExample generates Next.js App Router baseline", () => {
  const content = buildEnvExample({
    framework: { name: "next", variant: "app-router" },
  });

  assert.ok(content.includes("NEXT_PUBLIC_API_URL=https://api.example.com"));
  assert.ok(content.includes("https://nextjs.org/docs/app/building-your-application/configuring/environment-variables"));
  assert.equal(content.includes("VITE_API_URL"), false);
  assert.equal(content.includes("vite.dev"), false);
});

test("env: buildEnvExample generates Next.js Pages Router baseline", () => {
  const content = buildEnvExample({
    framework: { name: "next", variant: "pages-router" },
  });

  assert.ok(content.includes("NEXT_PUBLIC_API_URL=https://api.example.com"));
  assert.ok(content.includes("https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables"));
  assert.equal(content.includes("VITE_API_URL"), false);
});

test("env: buildEnvExample includes Prisma PostgreSQL URLs when database is prisma", () => {
  const content = buildEnvExample({
    framework: { name: "next", variant: "app-router" },
    database: "prisma",
  });

  assert.ok(content.includes("NEXT_PUBLIC_API_URL=https://api.example.com"));
  assert.ok(content.includes("DATABASE_URL="));
  assert.ok(content.includes("DIRECT_URL="));
  assert.ok(content.includes('DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"'));
  assert.ok(content.includes('DIRECT_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"'));
  assert.ok(content.includes("Supabase"));
  assert.ok(content.includes("pgbouncer=true"));
});

test("env: buildEnvExample includes Supabase pooler and direct URLs when provider is supabase", () => {
  const content = buildEnvExample({
    framework: { name: "next", variant: "app-router" },
    database: "prisma",
    databaseProvider: "supabase",
  });

  assert.ok(content.includes("NEXT_PUBLIC_API_URL="));
  assert.ok(content.includes("pooler.supabase.com:6543"));
  assert.ok(content.includes("pooler.supabase.com:5432"));
  assert.ok(content.includes("pgbouncer=true"));
  assert.ok(content.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert.ok(content.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});

test("env: buildEnvExample includes Docker port when docker is enabled", () => {
  const content = buildEnvExample({
    framework: { name: "next", variant: "app-router" },
    docker: true,
  });

  assert.ok(content.includes("PORT=3000"));
});

test("env: buildEnvExample preserves custom variables non-destructively and purges Vite vars in Next.js", () => {
  const existing = `
# Some existing configuration
VITE_API_URL=https://stray-vite.example.com
MY_SERVICE_API_KEY=secret_key_12345
CUSTOM_APP_NAME="My App"
`;
  const content = buildEnvExample(
    {
      framework: { name: "next", variant: "app-router" },
      database: "prisma",
    },
    existing
  );

  // Must contain Next and Prisma vars
  assert.ok(content.includes("NEXT_PUBLIC_API_URL="));
  assert.ok(content.includes("DATABASE_URL="));

  // Must preserve custom non-framework vars
  assert.ok(content.includes("MY_SERVICE_API_KEY=secret_key_12345"));
  assert.ok(content.includes('CUSTOM_APP_NAME="My App"'));

  // Must purge stray Vite var in Next.js
  assert.equal(content.includes("VITE_API_URL"), false);
  assert.equal(content.includes("stray-vite"), false);
});

test("env: copyEnvExample infers framework from package.json when responses is empty", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-env-infer-"));
  try {
    await fsp.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "my-next-app", dependencies: { next: "15.0.0" } }, null, 2)
    );
    await fsp.writeFile(path.join(dir, ".gitignore"), "node_modules\n.env*\n");

    await copyEnvExample(dir, TEMPLATES_DIR, {});

    const envContent = await fsp.readFile(path.join(dir, ".env.example"), "utf8");
    assert.ok(envContent.includes("NEXT_PUBLIC_API_URL="));
    assert.equal(envContent.includes("VITE_API_URL"), false);

    const gitignoreContent = await fsp.readFile(path.join(dir, ".gitignore"), "utf8");
    assert.ok(gitignoreContent.includes("!.env.example"));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("env: copyEnvExample ensures .gitignore has !.env.example without duplicate entries", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "lumen-env-git-"));
  try {
    await fsp.writeFile(path.join(dir, ".gitignore"), "node_modules\n!.env.example\n");

    await copyEnvExample(dir, TEMPLATES_DIR, {
      framework: { name: "react", variant: "vite" },
    });

    const gitignoreContent = await fsp.readFile(path.join(dir, ".gitignore"), "utf8");
    const count = (gitignoreContent.match(/!\.env\.example/g) || []).length;
    assert.equal(count, 1, "!.env.example must appear exactly once in .gitignore");
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
