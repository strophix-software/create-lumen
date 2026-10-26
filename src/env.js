import path from "path";
import { promises as fsp } from "fs";
import { normalizeFramework } from "./engine/capabilities.js";

const ENV_GITIGNORE = `
# Environment variables
.env
.env.*
!.env.example
`;

export async function resolveFramework(projectPath, responses = {}) {
  if (responses.framework || responses.frameworkName) {
    return normalizeFramework(
      responses.framework || {
        name: responses.frameworkName,
        variant: responses.frameworkVariant,
      }
    );
  }

  // Try reading lumen.config.json if already written
  try {
    const manifestPath = path.join(projectPath, "lumen.config.json");
    const content = await fsp.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed.framework) return normalizeFramework(parsed.framework);
  } catch {}

  // Try checking package.json
  try {
    const pkgPath = path.join(projectPath, "package.json");
    const content = await fsp.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    if (pkg.dependencies?.next || pkg.devDependencies?.next) {
      return { name: "next", variant: "app-router" };
    }
  } catch {}

  return { name: "react", variant: "vite" };
}

export function buildEnvExample(responses = {}, existingContent = "") {
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );

  const isNext = fw.name === "next";
  const lines = [];

  if (isNext) {
    const routerDocs =
      fw.variant === "pages-router"
        ? "https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables"
        : "https://nextjs.org/docs/app/building-your-application/configuring/environment-variables";

    lines.push("# Copy this file to `.env.local` (or `.env`) and fill in your values.");
    lines.push(`# See ${routerDocs} for details.`);
    lines.push("");

    // Public API client URL
    lines.push("# Public API URL (accessible in browser and server via process.env.NEXT_PUBLIC_API_URL)");
    lines.push("NEXT_PUBLIC_API_URL=https://api.example.com");

    // Database (Prisma)
    if (responses.database === "prisma" || existingContent.includes("DATABASE_URL")) {
      const isSupabase =
        responses.databaseProvider === "supabase" ||
        responses.dbProvider === "supabase" ||
        (!responses.databaseProvider && existingContent.includes("pooler.supabase.com"));

      lines.push("");
      if (isSupabase) {
        lines.push("# Database (Prisma + Supabase PostgreSQL)");
        lines.push("# Transaction connection pooler (port 6543) with PgBouncer - used by Next.js Server Components / Actions:");
        lines.push('DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"');
        lines.push("");
        lines.push("# Direct connection (port 5432) - used by Prisma CLI for migrations:");
        lines.push('DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"');
        lines.push("");
        lines.push("# Local development fallback (local PostgreSQL / Docker compose / Supabase local CLI):");
        lines.push('# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"');
        lines.push('# DIRECT_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"');
        lines.push("");
        lines.push("# Supabase API credentials (optional, for Supabase Auth / Storage)");
        lines.push('# NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"');
        lines.push('# NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."');
      } else {
        lines.push("# Database (Prisma + PostgreSQL)");
        lines.push("# Local development with PostgreSQL or Docker compose (docker compose up -d db):");
        lines.push('DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"');
        lines.push('DIRECT_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"');
        lines.push("");
        lines.push("# Supabase / cloud PostgreSQL with connection pooling (Transaction mode / port 6543):");
        lines.push('# DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"');
        lines.push('# DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"');
      }
    }

    // Docker
    if (responses.docker === true || existingContent.includes("PORT=")) {
      lines.push("");
      lines.push("# Server / Container Port (optional, defaults to 3000)");
      lines.push("# PORT=3000");
    }
  } else {
    // React / Vite
    lines.push("# Copy this file to `.env.local` (or `.env`) and fill in your values.");
    lines.push("# See https://vite.dev/guide/env-and-mode for how env vars are exposed.");
    lines.push("");
    lines.push("# Application API URL (accessible in Vite via import.meta.env.VITE_API_URL)");
    lines.push("VITE_API_URL=https://api.example.com");
  }

  lines.push("");
  let result = lines.join("\n");

  // If there was existing custom content, preserve custom non-framework variables
  if (existingContent && existingContent.trim()) {
    const existingLines = existingContent.split("\n");
    const preservedLines = [];
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Purge Vite references from Next.js scaffolds
      if (
        isNext &&
        (trimmed.startsWith("VITE_") ||
          trimmed.includes("vitejs.dev") ||
          trimmed.includes("vite.dev"))
      ) {
        continue;
      }
      // Purge Next.js references from React scaffolds
      if (!isNext && trimmed.startsWith("NEXT_PUBLIC_")) {
        continue;
      }

      // Check variable name
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const varName = trimmed.slice(0, eqIdx).trim();
        if (!result.includes(varName + "=")) {
          preservedLines.push(line);
        }
      }
    }
    if (preservedLines.length > 0) {
      result = result.trimEnd() + "\n\n# Custom environment variables\n" + preservedLines.join("\n") + "\n";
    }
  }

  return result;
}

export async function copyEnvExample(projectPath, templatesDir, responses = {}) {
  const fw = await resolveFramework(projectPath, responses);
  const resolvedResponses = { ...responses, framework: fw };

  const envPath = path.join(projectPath, ".env.example");
  let existingContent = "";
  try {
    existingContent = await fsp.readFile(envPath, "utf8");
  } catch {}

  const envContent = buildEnvExample(resolvedResponses, existingContent);
  await fsp.writeFile(envPath, envContent, "utf8");

  // Ensure the project gitignore excludes env files but keeps .env.example.
  const gitignore = path.join(projectPath, ".gitignore");
  try {
    let content = await fsp.readFile(gitignore, "utf8");
    if (!content.includes("!.env.example")) {
      content = content.replace(/\s*$/, "\n") + ENV_GITIGNORE.trimEnd() + "\n";
      await fsp.writeFile(gitignore, content, "utf8");
    }
  } catch {}
}
