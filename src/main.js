import { isCancel, log, spinner, text } from "@clack/prompts";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";

import { confirmEmptyFolder } from "@/confirm-empty-folder.js";
import { copyEnvExample } from "@/env.js";
import { cleanupBoilerplate } from "@/cleanup.js";
import { configureProject } from "@/configure.js";
import { setupCssFramework } from "@/css.js";
import { injectArchitecture, injectConditionals, injectFormatter } from "@/injector.js";
import { getPkgManager } from "@/utils/pkg-manager.js";
import { handleDevServer } from "@/utils/dev-server.js";
import { getUserInputs, onCancel } from "@/prompts.js";
import { runBaseInstall, runGitInit, runViteCreate, scaffoldBase } from "@/scaffold.js";
import { installAllDeps } from "@/dependencies.js";
import { generateReadme } from "@/readme.js";
import { runProjectFormat } from "@/format.js";
import { emitManifest } from "@/manifest/emit.js";
import { emitAgentContext } from "@/agent-context.js";

import { parseCliArgs, loadManifestSource, manifestToResponses, PRESETS } from "@/cli-args.js";
import { getProvider } from "@/engine/providers/base-provider.js";
import { normalizeFramework } from "@/engine/capabilities.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, "../templates");
const CURRENT_DIR = process.cwd();

export function resolveProjectName({ quickSetup = false, projectName: nameArg, cwd = CURRENT_DIR, rawArgs } = {}) {
  const cli = parseCliArgs(rawArgs || process.argv.slice(2));
  const cliArg = nameArg || cli.projectName || null;

  if (cliArg && cliArg.trim()) {
    return cliArg.trim();
  }

  if (quickSetup || cli.quickSetup || cli.manifest || cli.template) {
    const defaultName = path.basename(cwd).trim() || "my-app";
    return defaultName === "." ? "my-app" : defaultName;
  }

  return null;
}

export async function main(options = {}) {
  const {
    quickSetup = false,
    projectName: nameArg,
    manifest: manifestSource,
    template: templateName,
    framework: frameworkArg,
    arch: archArg,
  } = options;
  const pkg = getPkgManager();

  const isNonInteractive = Boolean(quickSetup || manifestSource || templateName);

  // 1. Project name
  let projectName = resolveProjectName({
    quickSetup: isNonInteractive,
    projectName: nameArg,
    cwd: CURRENT_DIR,
  });

  if (projectName) {
    log.step(chalk.gray(`Project name: ${chalk.bold(projectName)}`));
  } else {
    projectName = await text({
      message: "What is your project name?",
      placeholder: "my-app",
      validate(value) {
        if (!value || !value.trim()) return "Project name is required!";
      },
    });
    if (isCancel(projectName)) onCancel();
  }

  // 2. Handle existing folder
  await confirmEmptyFolder(projectName);

  // 3. Collect user preferences (interactive or non-interactive)
  let responses;
  if (manifestSource) {
    const manifestObj = loadManifestSource(manifestSource, CURRENT_DIR);
    responses = manifestToResponses(manifestObj, projectName);
  } else if (templateName) {
    const preset = PRESETS[templateName];
    if (!preset) {
      throw new Error(
        `Unknown template preset "${templateName}". Available presets: ${Object.keys(PRESETS).join(", ")}`
      );
    }
    responses = {
      projectName,
      ...preset,
    };
  } else {
    responses = await getUserInputs(projectName, { quickSetup, initialArch: archArg, framework: frameworkArg });
  }

  const projectPath = path.resolve(CURRENT_DIR, projectName);

  // 4. Scaffold the base project (provider-owned bases; Vite shells out, Next copies)
  const fw = normalizeFramework(
    responses.framework || { name: responses.frameworkName, variant: responses.frameworkVariant }
  );
  const createSpin = spinner();
  if (fw.name === "next") {
    createSpin.start("Creating your Next.js project...");
    try {
      const provider = getProvider(fw.name, fw.variant);
      const based = await scaffoldBase(projectPath, provider, responses.language, TEMPLATES_DIR);
      if (!based) {
        throw new Error(
          `Next.js base template not found for variant "${fw.variant}" (${responses.language}).`
        );
      }
      createSpin.stop(chalk.green("Project created successfully!"));
    } catch (err) {
      createSpin.stop(chalk.red("Failed to create project."));
      throw err;
    }
  } else {
    createSpin.start("Creating your Vite + React project...");
    try {
      await runViteCreate(projectPath, projectName, pkg, responses.language);
      createSpin.stop(chalk.green("Project created successfully!"));
    } catch (err) {
      createSpin.stop(chalk.red("Failed to create project."));
      throw err;
    }
  }

  // 5. Install base dependencies
  const depSpin = spinner();
  depSpin.start(`Installing dependencies using ${pkg}...`);
  try {
    await runBaseInstall(projectPath, pkg);
    depSpin.stop(chalk.green("Dependencies installed."));
  } catch (err) {
    depSpin.stop(chalk.red("Failed to install dependencies."));
    throw err;
  }

  // 6. Git init (if requested)
  if (responses.gitInit) {
    const gitSpin = spinner();
    gitSpin.start("Initializing git repository...");
    try {
      await runGitInit(projectPath);
      gitSpin.stop(chalk.green("Git repository initialized."));
    } catch (err) {
      gitSpin.stop(chalk.red("Git initialization failed."));
      throw err;
    }
  }

  // 7. Inject architecture templates
  const archSpin = spinner();
  archSpin.start(
    `Setting up ${responses.architecture} architecture...`
  );
  try {
    await injectArchitecture(
      projectPath,
      TEMPLATES_DIR,
      responses.architecture,
      responses.language,
      responses.cssFramework
    );
    archSpin.stop(chalk.green("Architecture scaffolding complete."));
  } catch (err) {
    archSpin.stop(chalk.red("Failed to scaffold architecture."));
    throw err;
  }

  // 8. Inject conditional features
  const condSpin = spinner();
  condSpin.start("Installing additional features...");
  try {
    await injectConditionals(
      projectPath,
      TEMPLATES_DIR,
      responses,
      responses.architecture,
      responses.language
    );
    condSpin.stop(chalk.green("Features configured."));
  } catch (err) {
    condSpin.stop(chalk.red("Failed to configure features."));
    throw err;
  }

  // 8.5 Inject formatter (config file + scripts + eslint-config-prettier wiring)
  const fmtSpin = spinner();
  fmtSpin.start("Configuring code formatter...");
  try {
    await injectFormatter(projectPath, TEMPLATES_DIR, responses);
    fmtSpin.stop(chalk.green("Formatter configured."));
  } catch (err) {
    fmtSpin.stop(chalk.red("Failed to configure formatter."));
    throw err;
  }

  // 9. Install all additional dependencies in one batch
  const extrasSpin = spinner();
  extrasSpin.start("Installing additional dependencies...");
  try {
    await installAllDeps(responses, pkg, projectPath);
    extrasSpin.stop(chalk.green("Additional dependencies installed."));
  } catch (err) {
    extrasSpin.stop(chalk.red("Failed to install additional dependencies."));
    throw err;
  }

  // 10. CSS framework setup
  const cssSpin = spinner();
  const cssLabel =
    responses.cssFramework === "tailwind"
      ? "Tailwind CSS"
      : "CSS reset";
  if (responses.cssFramework !== "none") {
    cssSpin.start(`Setting up ${cssLabel}...`);
  }
  try {
    await setupCssFramework({
      projectPath,
      templatesDir: TEMPLATES_DIR,
      language: responses.language,
      cssFramework: responses.cssFramework,
      architecture: responses.architecture,
      ext: responses.language === "ts" ? "tsx" : "jsx",
      pkg,
    });
    if (responses.cssFramework !== "none") {
      cssSpin.stop(chalk.green(`${cssLabel} setup complete.`));
    }
  } catch (err) {
    cssSpin.stop(chalk.red(`Failed to setup ${cssLabel}.`));
    throw err;
  }

  // 11. Configure path aliases + package.json
  const configSpin = spinner();
  configSpin.start("Configuring project...");
  try {
    await configureProject(projectPath, responses.language, responses.cssFramework);
    configSpin.stop(chalk.green("Project configured."));
  } catch (err) {
    configSpin.stop(chalk.red("Failed to configure project."));
    throw err;
  }

  // 12. Cleanup boilerplate
  await cleanupBoilerplate(projectPath);

  // 12.5 Copy .env.example into the project
  await copyEnvExample(projectPath, TEMPLATES_DIR, responses);

  // 12.6 Emit lumen.config.json (manifest v2) — byte-deterministic, Zod-validated
  const manifestSpin = spinner();
  manifestSpin.start("Writing lumen.config.json...");
  try {
    await emitManifest(projectPath, responses);
    manifestSpin.stop(chalk.green("lumen.config.json written."));
  } catch (err) {
    manifestSpin.stop(chalk.red("Failed to write lumen.config.json."));
    throw err;
  }

  // 12.7 Emit .lumen agent context dir (only when agentDocs is enabled)
  if (responses.agentDocs === true || responses._manifestSource?.agentDocs === true) {
    const agentSpin = spinner();
    agentSpin.start("Writing .lumen agent context...");
    try {
      await emitAgentContext(projectPath, responses._manifestSource ?? responses);
      agentSpin.stop(chalk.green(".lumen agent context written."));
    } catch (err) {
      agentSpin.stop(chalk.red("Failed to write .lumen agent context."));
      throw err;
    }
  }

  // 13. Generate README.md + LICENSE (if requested)
  if (responses.readme) {
    const readmeSpin = spinner();
    readmeSpin.start("Generating README.md and LICENSE...");
    try {
      await generateReadme(projectPath, projectName, responses);
      readmeSpin.stop(chalk.green("README.md and LICENSE generated."));
    } catch (err) {
      readmeSpin.stop(chalk.red("Failed to generate README.md and LICENSE."));
      throw err;
    }
  }

  // 13.5 Format the freshly generated project so it is canonical on init
  if (responses.formatter && responses.formatter !== "none") {
    const fmtPassSpin = spinner();
    fmtPassSpin.start(`Formatting project with ${responses.formatter}...`);
    try {
      await runProjectFormat(projectPath, responses);
      fmtPassSpin.stop(chalk.green("Project formatted."));
    } catch (err) {
      fmtPassSpin.stop(chalk.red("Failed to format project."));
      throw err;
    }
  }

  log.step(chalk.green("\nProject setup complete!"));
  log.message(
    chalk.gray(
      `  Architecture: ${responses.architecture}`
    )
  );

  // 14. Offer dev server
  await handleDevServer(pkg, projectName);
}
