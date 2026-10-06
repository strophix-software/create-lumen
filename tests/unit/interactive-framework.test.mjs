import test from "node:test";
import assert from "node:assert/strict";
import { formatConfig, getUserInputs } from "../../src/prompts.js";
import { computeDeps } from "../../src/dependencies.js";

const BASE_ANSWERS = {
  architecture: "feature-based",
  language: "ts",
  cssFramework: "tailwind",
  testing: "vitest",
  bundler: "turbopack",
  adapter: "none",
  reactCompiler: false,
  stateManagement: "none",
  iconLibrary: "none",
  apiClient: "none",
  gitInit: false,
  linter: "eslint",
  formatter: "prettier",
  docsLanguage: "en",
  readme: false,
};

function scriptedSelect(script) {
  return async ({ message }) => {
    if (!(message in script)) {
      throw new Error(`Unexpected prompt: ${message}`);
    }
    return script[message];
  };
}

const noop = async () => {};

test("prompts: interactive framework step selects Next App Router and gates router/bundler", async () => {
  const responses = await getUserInputs("next-proj", {
    selectFn: scriptedSelect({
      "Which framework do you want to scaffold?": "next",
      "Which Next.js router do you want to use?": "app-router",
      "Quick Setup? (TypeScript + Tailwind + Feature-based + ESLint + Vitest)":
        false,
      "Which project architecture do you want?": "feature-based",
      "Which language do you want to use?": "ts",
      "Which CSS framework do you want to use?": "tailwind",
      "Which testing framework do you want to set up?": "vitest",
      "Which bundler do you want to use?": "turbopack",
      "Which deployment adapter do you want to use?": "none",
      "Would you like to enable the React Compiler (experimental)?": false,
      "Which state management library do you want to use?": "none",
      "Which icon library would you like to use?": "none",
      "Which API client do you want to use?": "none",
      "Would you like to initialize a Git repository?": false,
      "Which linter do you want to use?": "eslint",
      "Which formatter do you want to use?": "prettier",
      "Which docs language do you want?": "en",
      "Would you like to generate a README.md and LICENSE?": false,
      "Proceed with project generation?": true,
    }),
    noteFn: noop,
    saveConfigFn: noop,
    configExistsFn: async () => false,
  });

  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "app-router");
  assert.equal(responses.router, false);
  assert.equal(responses.bundler, "turbopack");
  assert.ok(!("adapter" in responses));
});

test("prompts: framework flag skips the interactive framework prompt", async () => {
  let sawFrameworkPrompt = false;
  const responses = await getUserInputs("flag-proj", {
    framework: "next:pages-router",
    selectFn: async ({ message }) => {
      if (message === "Which framework do you want to scaffold?") {
        sawFrameworkPrompt = true;
      }
      if (message.startsWith("Quick Setup?")) return true;
      if (message === "Proceed with project generation?") return true;
      throw new Error(`Unexpected prompt: ${message}`);
    },
    noteFn: noop,
    saveConfigFn: noop,
    configExistsFn: async () => false,
  });

  assert.equal(sawFrameworkPrompt, false);
  assert.equal(responses.frameworkName, "next");
  assert.equal(responses.frameworkVariant, "pages-router");
});

test("prompts: formatConfig shows the selected framework first", () => {
  const out = formatConfig({ ...BASE_ANSWERS, frameworkName: "next", frameworkVariant: "pages-router" });
  assert.match(out, /Next\.js \(Pages Router\)/);
  const appOut = formatConfig({ ...BASE_ANSWERS, frameworkName: "next", frameworkVariant: "app-router" });
  assert.match(appOut, /Next\.js \(App Router\)/);
  const reactOut = formatConfig({ ...BASE_ANSWERS, frameworkName: "react", frameworkVariant: "vite" });
  assert.match(reactOut, /React \+ Vite/);
});

test("deps: frameworkName form selects Next.js dependency paths", () => {
  const { devDeps } = computeDeps({
    cssFramework: "tailwind",
    frameworkName: "next",
    frameworkVariant: "app-router",
    stateManagement: "none",
    router: false,
    iconLibrary: "none",
    apiClient: "none",
    testing: "none",
    linter: "eslint",
    formatter: "none",
    language: "ts",
  });
  assert.ok(devDeps.includes("@tailwindcss/postcss"));
  assert.ok(devDeps.includes("eslint-config-next"));
  assert.ok(!devDeps.includes("@tailwindcss/vite"));
});

test("deps: biome linter installs the biome toolchain", () => {
  const { devDeps } = computeDeps({
    cssFramework: "none",
    frameworkName: "react",
    frameworkVariant: "vite",
    stateManagement: "none",
    router: false,
    iconLibrary: "none",
    apiClient: "none",
    testing: "none",
    linter: "biome",
    formatter: "none",
    language: "ts",
  });
  assert.ok(devDeps.includes("@biomejs/biome"));
});
