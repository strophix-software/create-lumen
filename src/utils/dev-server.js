import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import path from "path";

export async function handleDevServer(
  pkg,
  projectPathOrName,
  {
    isNonInteractive = false,
    projectName = null,
    selectFn = select,
    execaFn = execa,
    isTTY = process.stdin.isTTY,
  } = {}
) {
  const targetDir = path.isAbsolute(projectPathOrName)
    ? projectPathOrName
    : path.resolve(process.cwd(), projectPathOrName);
  const displayName = projectName || path.basename(projectPathOrName);

  if (isNonInteractive || process.env.CI || !isTTY) {
    printNextSteps(displayName, pkg);
    return;
  }

  const startDev = await selectFn({
    message: "Start the development server?",
    options: [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    initialValue: true,
  });

  if (isCancel(startDev)) {
    printNextSteps(displayName, pkg);
    return;
  }

  if (startDev) {
    console.log(chalk.green("\nStarting dev server...\n"));
    try {
      await execaFn(pkg, ["run", "dev"], { cwd: targetDir, stdio: "inherit" });
    } catch (err) {
      if (
        err?.signal === "SIGINT" ||
        err?.signal === "SIGTERM" ||
        err?.exitCode === 130
      ) {
        return;
      }
      throw err;
    }
  } else {
    printNextSteps(displayName, pkg);
  }
}

function printNextSteps(displayName, pkg) {
  console.log(chalk.bold("\nNext steps:"));
  if (displayName !== "." && displayName !== "") {
    console.log(chalk.gray(`  cd ${displayName}`));
  }
  console.log(chalk.gray(`  ${pkg} run dev\n`));
}
