import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";

export async function handleDevServer(pkg, projectName, { isNonInteractive = false } = {}) {
  if (isNonInteractive || process.env.CI || !process.stdin.isTTY) {
    printNextSteps(projectName, pkg);
    return;
  }

  const startDev = await select({
    message: "Start the development server?",
    options: [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    initialValue: true,
  });

  if (isCancel(startDev)) {
    printNextSteps(projectName, pkg);
    return;
  }

  if (startDev) {
    console.log(chalk.green("\nStarting dev server...\n"));
    await execa(pkg, ["run", "dev"], { stdio: "inherit" });
  } else {
    printNextSteps(projectName, pkg);
  }
}

function printNextSteps(projectName, pkg) {
  console.log(chalk.bold("\nNext steps:"));
  if (projectName !== ".") {
    console.log(chalk.gray(`  cd ${projectName}`));
  }
  console.log(chalk.gray(`  ${pkg} run dev\n`));
}
