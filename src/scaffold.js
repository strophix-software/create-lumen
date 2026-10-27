import { promises as fsp } from "fs";
import path from "path";
import { execa } from "execa";
import { copyDirRecursive } from "@/utils/fs.js";
import { isYarnV1 } from "@/utils/yarn-v1.js";

export async function runViteCreate(projectPath, projectName, pkg, language, isCurrentDir = false) {
  const useYarn = pkg === "yarn";
  const isYarn1 = useYarn && isYarnV1();
  const useNpm = pkg === "npm";
  const template = language === "ts" ? "react-ts" : "react";

  const isCurrent = isCurrentDir || projectName === "." || projectPath === process.cwd();
  const target = isCurrent ? "." : projectName;
  const execCwd = isCurrent ? projectPath : path.dirname(projectPath);

  const createArgs = [
    "create",
    isYarn1 ? "vite" : "vite@latest",
    target,
    useNpm && "--",
    "--template",
    template,
  ].filter(Boolean);

  await execa(pkg, createArgs, { stdio: "pipe", cwd: execCwd });
}

export async function runBaseInstall(projectPath, pkg) {
  await execa(pkg, ["install"], { stdio: "pipe", cwd: projectPath });
}

export async function runGitInit(projectPath) {
  await execa("git", ["init"], { stdio: "pipe", cwd: projectPath });
}

export async function scaffoldBase(projectPath, provider, language, templatesDir) {
  if (provider && typeof provider.getFilePlan === "function") {
    const filePlan = provider.getFilePlan({ lang: language });
    const baseDir = path.join(templatesDir, "..", filePlan);
    try {
      await fsp.access(baseDir);
      await copyDirRecursive(baseDir, projectPath);
      return true;
    } catch {
      // Base directory does not exist yet in templates/bases
    }
  }
  return false;
}
