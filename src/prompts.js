import { isCancel, note, select } from "@clack/prompts";
import chalk from "chalk";
import { configExists, loadConfig, saveConfig } from "@/config-cache.js";
import {
  isPromptVisible,
  filterCompatibleChoices,
  getDefaultResponses,
  sanitizeResponsesForFramework,
  normalizeFramework,
} from "./engine/capabilities.js";

export const BACK = Symbol("back");
export const CANCEL = Symbol("cancel");

export function onCancel() {
  console.log(chalk.gray("\n\nOperation cancelled.\n"));
  process.exit(1);
}

export function formatConfig(responses) {
  const lang = responses.language === "ts" ? "TypeScript" : "JavaScript";
  const arch =
    responses.architecture === "feature-based"
      ? "Feature-based"
      : responses.architecture === "type-based" || responses.architecture === "component-based"
      ? "Type-based"
      : responses.architecture === "hybrid"
      ? "Hybrid (shared + features)"
      : responses.architecture === "none"
      ? "None (flat src)"
      : responses.architecture;
  const css =
    responses.cssFramework === "none"
      ? "None"
      : "Tailwind CSS";
  const testing =
    responses.testing === "none"
      ? "None"
      : responses.testing === "vitest"
      ? "Vitest"
      : "Jest";
  const state =
    responses.stateManagement === "none"
      ? "None"
      : responses.stateManagement === "redux"
      ? "Redux Toolkit"
      : "Zustand";

  const docsLang = responses.docsLanguage === "es" ? "ES" : responses.docsLanguage === "en" ? "EN" : "â€”";
  const lines = [
    `â€¢ ${chalk.bold("Architecture:")} ${chalk.green(arch)}`,
    `â€¢ ${chalk.bold("Language:")} ${chalk.green(lang)}`,
    `â€¢ ${chalk.bold("CSS:")} ${chalk.yellow(css)}`,
    `â€¢ ${chalk.bold("Testing:")} ${chalk.magenta(testing)}`,
  ];

  if (responses.router !== undefined) {
    lines.push(`â€¢ ${chalk.bold("Router:")} ${responses.router ? chalk.green("Yes") : chalk.red("No")}`);
  }
  if (responses.bundler) {
    lines.push(`â€¢ ${chalk.bold("Bundler:")} ${chalk.cyan(responses.bundler)}`);
  }
  if (responses.adapter && responses.adapter !== "none") {
    lines.push(`â€¢ ${chalk.bold("Adapter:")} ${chalk.cyan(responses.adapter)}`);
  }
  if (responses.reactCompiler !== undefined) {
    lines.push(`â€¢ ${chalk.bold("React Compiler:")} ${responses.reactCompiler ? chalk.green("Yes") : chalk.red("No")}`);
  }
  lines.push(
    `â€¢ ${chalk.bold("State:")} ${chalk.blue(state)}`,
    `â€¢ ${chalk.bold("Icons:")} ${chalk.blue(responses.iconLibrary === "none" ? "None" : responses.iconLibrary === "lucide" ? "Lucide" : "Huge")}`,
    `â€¢ ${chalk.bold("API Client:")} ${responses.apiClient === "axios" ? chalk.green("Axios") : responses.apiClient === "fetch" ? chalk.yellow("Fetch") : chalk.red("None")}`,
    `â€¢ ${chalk.bold("Linter:")} ${responses.linter === "oxlint" ? chalk.green("Oxlint") : responses.linter === "biome" ? chalk.cyan("Biome") : responses.linter === "eslint" ? chalk.yellow("ESLint") : chalk.red("None")}`,
    `â€¢ ${chalk.bold("Formatter:")} ${responses.formatter === "oxfmt" ? chalk.green("Oxfmt") : responses.formatter === "prettier" ? chalk.yellow("Prettier") : chalk.red("None")}`,
    `â€¢ ${chalk.bold("Docs:")} ${chalk.cyan(docsLang)}`,
    `â€¢ ${chalk.bold("Git:")} ${responses.gitInit ? chalk.green("Yes") : chalk.red("No")}`,
    `â€¢ ${chalk.bold("README:")} ${responses.readme ? chalk.green("Yes") : chalk.red("No")}`
  );
  return lines.join("\n");
}


/**
 * Generic step-based runner with history stack and back navigation.
 */
export async function runPromptFlow({
  steps,
  initialAnswers = {},
  selectFn = select,
  noteFn = note,
  onCancelFn = onCancel,
} = {}) {
  const answers = { ...initialAnswers };
  const history = [];
  let currentIndex = 0;

  while (currentIndex < steps.length) {
    const step = steps[currentIndex];

    // Check skip condition
    if (step.skip?.(answers)) {
      step.onSkip?.(answers);
      currentIndex++;
      continue;
    }

    const canGoBack = history.length > 0;
    let res;

    if (step.render) {
      res = await step.render(answers, canGoBack, { selectFn, noteFn });
    } else {
      const stepOptions =
        typeof step.getOptions === "function" ? step.getOptions(answers) : step.options;
      const options = [
        ...stepOptions,
        ...(canGoBack
          ? [{ label: chalk.dim("ÔåÉ Back"), value: BACK, hint: "Return to previous question" }]
          : []),
      ];

      const prevValue = answers[step.id];
      const hasPrevValue =
        prevValue !== undefined && stepOptions.some((o) => o.value === prevValue);
      const defaultInitial =
        typeof step.defaultInitial === "function"
          ? step.defaultInitial(answers)
          : step.defaultInitial;
      const initialValue = hasPrevValue ? prevValue : defaultInitial;

      res = await selectFn({
        message: step.message,
        options,
        initialValue,
      });
    }

    if (isCancel(res) || res === CANCEL) {
      onCancelFn();
      return null;
    }

    if (res === BACK) {
      if (history.length > 0) {
        currentIndex = history.pop();
      }
      continue;
    }

    // Step produced a normal answer
    if (step.onAnswer) {
      const nextIndex = step.onAnswer(res, answers, { history, currentIndex, steps });
      if (typeof nextIndex === "number") {
        history.push(currentIndex);
        currentIndex = nextIndex;
        continue;
      }
    } else if (step.id) {
      answers[step.id] = res;
    }

    history.push(currentIndex);
    currentIndex++;
  }

  return answers;
}

export async function getUserInputs(
  projectName,
  {
    quickSetup = false,
    framework: rawFramework,
    initialArch = null,
    selectFn = select,
    noteFn = note,
    saveConfigFn = saveConfig,
    configExistsFn = configExists,
    loadConfigFn = loadConfig,
  } = {}
) {
  const framework = normalizeFramework(rawFramework);
  // Non-interactive quick setup: capability-aware defaults without prompting.
  if (quickSetup) {
    const responses = getDefaultResponses(framework, { projectName });
    if (initialArch) responses.architecture = initialArch;
    await saveConfigFn(responses);
    return responses;
  }

  let oldConfig = null;
  const hasPrevious = await configExistsFn();
  if (hasPrevious) {
    oldConfig = await loadConfigFn();
    oldConfig.projectName = projectName;
    // Sanitize cached setup against current framework capabilities
    oldConfig = sanitizeResponsesForFramework(framework, oldConfig);
  }

  const steps = [];

  if (hasPrevious) {
    steps.push({
      id: "useExisting",
      render: async (_ans, _canGoBack, { selectFn: sFn, noteFn: nFn }) => {
        nFn(
          `Previous setup found:\n\n${formatConfig(oldConfig)}\n`,
          "Previous Configuration"
        );
        return await sFn({
          message: "How would you like to proceed?",
          options: [
            { value: true, label: "Continue with previous setup" },
            { value: false, label: "Start fresh (new setup)" },
          ],
          initialValue: true,
        });
      },
      onAnswer: (val, ans) => {
        ans.useExisting = val;
        if (val === true) {
          if (oldConfig.apiClient === undefined) {
            oldConfig.apiClient = oldConfig.axios ? "axios" : "none";
          }
          if (oldConfig.formatter === undefined) {
            oldConfig.formatter = "none";
          }
          if (oldConfig.docsLanguage === undefined) {
            oldConfig.docsLanguage = "en";
          }
          return steps.length; // exit immediately
        }
        return null;
      },
    });
  }

  steps.push(
    {
      id: "quickSetup",
      message: isPromptVisible(framework, "router")
        ? "Quick Setup? (TypeScript + Tailwind + Feature-based + Router + ESLint + Vitest)"
        : "Quick Setup? (TypeScript + Tailwind + Feature-based + ESLint + Vitest)",
      getOptions: () => [
        { label: "Yes, use recommended defaults", value: true },
        { label: "No, custom setup", value: false },
      ],
      defaultInitial: true,
      onAnswer: (val, ans, { steps: allSteps }) => {
        ans.quickSetup = val;
        if (val === true) {
          const defaults = getDefaultResponses(framework, { projectName });
          Object.assign(ans, defaults, { projectName, quickSetup: true });
          if (initialArch) ans.architecture = initialArch;
          // Jump to finalConfirm
          return allSteps.length - 1;
        }
        return null;
      },
    },
    {
      id: "architecture",
      message: "Which project architecture do you want?",
      getOptions: () =>
        filterCompatibleChoices(framework, "architecture", [
          {
            label: "Feature-based",
            value: "feature-based",
            hint: "Scales to large apps — code grouped by business domain",
          },
          {
            label: "Type-based",
            value: "type-based",
            hint: "Small apps / component libraries — code grouped by UI type",
          },
          {
            label: "Hybrid",
            value: "hybrid",
            hint: "Next.js: features + shared code",
          },
          {
            label: "None",
            value: "none",
            hint: "Minimal flat src/ scaffold — no imposed structure",
          },
        ]),
      defaultInitial: initialArch || "feature-based",
    },
    {
      id: "language",
      message: "Which language do you want to use?",
      getOptions: () =>
        filterCompatibleChoices(framework, "language", [
          { label: "TypeScript", value: "ts" },
          { label: "JavaScript", value: "js" },
        ]),
      defaultInitial: "ts",
    },
    {
      id: "cssFramework",
      message: "Which CSS framework do you want to use?",
      getOptions: () =>
        filterCompatibleChoices(framework, "styling", [
          { label: "Tailwind CSS", value: "tailwind" },
          { label: "None", value: "none" },
        ]),
      defaultInitial: "tailwind",
    },
    {
      id: "testing",
      message: "Which testing framework do you want to set up?",
      getOptions: () => [
        { label: "Vitest", value: "vitest" },
        { label: "Jest", value: "jest" },
        { label: "None", value: "none" },
      ],
      defaultInitial: "vitest",
    },
    {
      id: "router",
      skip: () => !isPromptVisible(framework, "router"),
      onSkip: (ans) => {
        ans.router = false;
      },
      message: "Would you like to install React Router?",
      getOptions: () => [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
      defaultInitial: true,
    },
    {
      id: "bundler",
      skip: () => !isPromptVisible(framework, "bundler"),
      onSkip: (ans) => {
        ans.bundler = undefined;
      },
      message: "Which bundler do you want to use?",
      getOptions: () =>
        filterCompatibleChoices(framework, "bundler", [
          { label: "Turbopack", value: "turbopack" },
          { label: "Webpack", value: "webpack" },
        ]),
      defaultInitial: "turbopack",
    },
    {
      id: "adapter",
      skip: () => !isPromptVisible(framework, "adapter"),
      onSkip: (ans) => {
        ans.adapter = "none";
      },
      message: "Which deployment adapter do you want to use?",
      getOptions: () =>
        filterCompatibleChoices(framework, "adapter", [
          { label: "None (default)", value: "none" },
          { label: "Node", value: "node" },
          { label: "Vercel", value: "vercel" },
          { label: "Cloudflare", value: "cloudflare" },
          { label: "Static", value: "static" },
        ]),
      defaultInitial: "none",
    },
    {
      id: "reactCompiler",
      skip: () => !isPromptVisible(framework, "reactCompiler"),
      onSkip: (ans) => {
        ans.reactCompiler = false;
      },
      message: "Would you like to enable the React Compiler (experimental)?",
      getOptions: () => [
        { label: "No (default)", value: false },
        { label: "Yes", value: true },
      ],
      defaultInitial: false,
    },
    {
      id: "stateManagement",
      message: "Which state management library do you want to use?",
      getOptions: () => [
        { label: "None", value: "none" },
        { label: "Redux Toolkit", value: "redux" },
        { label: "Zustand", value: "zustand" },
      ],
      defaultInitial: "none",
    },
    {
      id: "iconLibrary",
      message: "Which icon library would you like to use?",
      getOptions: () => [
        { label: "None", value: "none" },
        { label: "Lucide Icons", value: "lucide" },
        { label: "Huge Icons", value: "huge" },
      ],
      defaultInitial: "none",
    },
    {
      id: "apiClient",
      message: "Which API client do you want to use?",
      getOptions: () => [
        { label: "None", value: "none" },
        { label: "Axios", value: "axios" },
        { label: "Fetch (native)", value: "fetch" },
      ],
      defaultInitial: "none",
    },
    {
      id: "gitInit",
      message: "Would you like to initialize a Git repository?",
      getOptions: () => [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
      defaultInitial: false,
    },
    {
      id: "linter",
      message: "Which linter do you want to use?",
      getOptions: () =>
        filterCompatibleChoices(framework, "linter", [
          {
            label: "ESLint",
            value: "eslint",
            hint: "Industry standard JavaScript linter (Recommended)",
          },
          { label: "Oxlint", value: "oxlint", hint: "Fast Rust-based linter" },
          { label: "Biome", value: "biome", hint: "Toolchain for web projects" },
          { label: "None", value: "none" },
        ]),
      defaultInitial: "eslint",
    },
    {
      id: "formatter",
      skip: (ans) => ans.linter === "none",
      onSkip: (ans) => {
        ans.formatter = "none";
      },
      message: "Which formatter do you want to use?",
      getOptions: (ans) =>
        filterCompatibleChoices(
          framework,
          "formatter",
          ans.linter === "eslint"
            ? [
                { label: "None", value: "none" },
                { label: "Prettier", value: "prettier" },
              ]
            : [
                { label: "None", value: "none" },
                { label: "Oxfmt (Recommended)", value: "oxfmt" },
                { label: "Prettier", value: "prettier" },
              ]
        ),
      defaultInitial: (ans) => {
        const compatible = filterCompatibleChoices(
          framework,
          "formatter",
          ans.linter === "eslint"
            ? [{ value: "none" }, { value: "prettier" }]
            : [{ value: "none" }, { value: "oxfmt" }, { value: "prettier" }]
        ).map((o) => o.value);
        const preferred = ans.linter === "eslint" ? "prettier" : "oxfmt";
        return compatible.includes(preferred) ? preferred : compatible[0];
      },
    },
    {
      id: "docsLanguage",
      message: "Which docs language do you want?",
      getOptions: () => [
        { label: "English", value: "en" },
        { label: "Español", value: "es" },
      ],
      defaultInitial: "en",
    },
    {
      id: "readme",
      message: "Would you like to generate a README.md and LICENSE?",
      getOptions: () => [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
      defaultInitial: true,
    },
    {
      id: "finalConfirm",
      render: async (ans, canGoBack, { selectFn: sFn, noteFn: nFn }) => {
        nFn(`\n${formatConfig(ans)}\n`, "Project Configuration Summary");
        return await sFn({
          message: "Proceed with project generation?",
          options: [
            { label: "Confirm and scaffold project", value: true },
            ...(canGoBack
              ? [{ label: chalk.dim("← Back to edit options"), value: BACK }]
              : []),
          ],
          initialValue: true,
        });
      },
    }
  );

  const responses = await runPromptFlow({
    steps,
    initialAnswers: { projectName },
    selectFn,
    noteFn,
    onCancelFn: onCancel,
  });

  if (responses.useExisting) {
    return { ...oldConfig, projectName };
  }

  const {
    useExisting: _useExisting,
    quickSetup: _quickSetup,
    bundler,
    adapter,
    reactCompiler,
    agentDocs,
    ...picked
  } = responses;
  const finalResponses = {
    projectName,
    frameworkName: framework.name,
    frameworkVariant: framework.variant,
    ...picked,
  };
  if (bundler !== undefined) {
    finalResponses.bundler = bundler;
  }
  if (adapter !== undefined && adapter !== "none") {
    finalResponses.adapter = adapter;
  }
  if (reactCompiler !== undefined) {
    finalResponses.reactCompiler = reactCompiler;
  }
  if (agentDocs !== undefined) {
    finalResponses.agentDocs = agentDocs;
  }

  // No config cache write until final confirm!
  await saveConfigFn(finalResponses);
  return finalResponses;
}
