import path from "path";
import { execa } from "execa";
import { promises as fsp } from "fs";

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

// Runs the project-local formatter (installed as a devDependency) so a freshly
// generated project is canonical under its chosen formatter by construction.
// Falls back to the bare command name so the same helper works when the binary
// is already on PATH (e.g. verification harnesses resolving from a vendored
// node_modules symlink).
export async function runProjectFormat(projectPath, responses) {
  if (responses.formatter && responses.formatter !== "none") {
    const formatter = responses.formatter;
    const bin = path.join(projectPath, "node_modules", ".bin", formatter);
    const command = (await exists(bin)) ? bin : formatter;
    const args = formatter === "prettier" ? ["--write", "."] : ["."];

    await execa(command, args, { cwd: projectPath, stdio: "pipe" });
    return;
  }

  // When Biome is the linter and no separate formatter is chosen, use Biome's native check --write
  if (responses.linter === "biome") {
    const bin = path.join(projectPath, "node_modules", ".bin", "biome");
    const command = (await exists(bin)) ? bin : "biome";
    await execa(command, ["check", "--write", "."], { cwd: projectPath, stdio: "pipe" });
  }
}