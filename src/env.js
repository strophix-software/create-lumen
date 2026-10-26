import path from "path";
import { promises as fsp } from "fs";
import { normalizeFramework } from "./engine/capabilities.js";

const ENV_GITIGNORE = `
# Environment variables
.env
.env.*
!.env.example
`;

const NEXT_ENV_EXAMPLE = `# Copy this file to \`.env.local\` (or \`.env\`) and fill in your values.
# See https://nextjs.org/docs/app/building-your-application/configuring/environment-variables for details.

NEXT_PUBLIC_API_URL=https://api.example.com
`;

export async function copyEnvExample(projectPath, templatesDir, responses = {}) {
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );

  if (fw.name === "next") {
    await fsp.writeFile(path.join(projectPath, ".env.example"), NEXT_ENV_EXAMPLE, "utf8");
  } else {
    const src = path.join(templatesDir, ".env.example");
    try {
      await fsp.access(src);
      await fsp.copyFile(src, path.join(projectPath, ".env.example"));
    } catch {}
  }

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
