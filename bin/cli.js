#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import chalk from "chalk";
import "../register.js";
import { parseCliArgs, printHelp } from "../src/cli-args.js";

const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);

const cliArgs = parseCliArgs(process.argv.slice(2));

if (cliArgs.help) {
  printHelp();
  process.exit(0);
}

if (cliArgs.version) {
  console.log(version);
  process.exit(0);
}

console.log(
  chalk.bold.cyan("\n  ✦ LUMEN") +
    chalk.gray(` v${version}`) +
    chalk.gray(
      "\n  Scaffold a React, Vite, or Next.js project with architecture choice\n"
    )
);

const { main } = await import("@/main.js");

main({
  quickSetup: cliArgs.quickSetup,
  projectName: cliArgs.projectName,
  manifest: cliArgs.manifest,
  template: cliArgs.template,
  framework: cliArgs.framework,
  arch: cliArgs.arch,
}).catch((e) => {
  console.error(chalk.red("\nError:"), e.message || e);
  process.exit(1);
});
