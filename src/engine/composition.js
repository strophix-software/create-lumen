import { promises as fsp } from "fs";
import path from "path";
import { copyDirRecursive, writeFileRecursive } from "@/utils/fs.js";
import {
  CAPABILITIES,
  hasCapability,
  normalizeFramework,
} from "./capabilities.js";
import { getProvider } from "./providers/base-provider.js";

/**
 * Capability-scoped fragment constants.
 * Represents the 5 architectural layers of Lumen project composition.
 */
export const FRAGMENT_SCOPES = {
  BASE: "base",
  FRAMEWORK: "framework",
  ARCH: "arch",
  STYLING: "styling",
  TOOLING: "tooling",
};

/**
 * Documented deterministic precedence order.
 * Earlier layers form the foundation; later layers overwrite on path collision.
 * base -> framework -> arch -> styling -> tooling
 */
export const FRAGMENT_PRECEDENCE = [
  FRAGMENT_SCOPES.BASE,
  FRAGMENT_SCOPES.FRAMEWORK,
  FRAGMENT_SCOPES.ARCH,
  FRAGMENT_SCOPES.STYLING,
  FRAGMENT_SCOPES.TOOLING,
];

/**
 * Deterministic execution order for tooling sub-categories.
 */
export const TOOLING_ORDER = [
  "state",
  "router",
  "icons",
  "api",
  "testing",
  "linter",
  "feature-script",
  "next-config",
  "docker",
  "formatter",
];

/**
 * Narrow a template tree copy to the selected language: .tsx/.ts for ts,
 * .jsx/.js for js (keeps the opposite language's files out of the project).
 * @param {string} language - "ts" | "js"
 * @returns {(name: string) => boolean}
 */
export function langFileFilter(language) {
  return (name) => {
    if (language === "ts") {
      if (name.endsWith(".jsx")) return false;
      if (name.endsWith(".js")) return false;
      return true;
    }
    if (language === "js") {
      if (name.endsWith(".tsx")) return false;
      if (name.endsWith(".ts")) return false;
      return true;
    }
    return true;
  };
}

/**
 * Remove .gitkeep placeholders from src/ directories that now contain real
 * files. A folder with nothing but its placeholder keeps it.
 * @param {string} projectPath
 */
export async function pruneRedundantGitkeeps(projectPath) {
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name));
      }
    }
    if (entries.some((e) => e.name === ".gitkeep")) {
      const hasRealFiles = entries.some((e) => e.isFile() && e.name !== ".gitkeep");
      if (hasRealFiles) {
        await fsp.rm(path.join(dir, ".gitkeep"), { force: true });
      }
    }
  };
  await walk(path.join(projectPath, "src"));
}

/**
 * Resolve the complete, deterministic list of template fragments to apply
 * for a given responses configuration.
 *
 * @param {object} responses - Generation options
 * @param {string} templatesDir - Absolute path to templates root
 * @returns {Array<object>} Ordered array of fragment descriptors
 */
export function resolveFragments(responses = {}, templatesDir) {
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );
  const language = responses.language || "ts";
  const ext = language === "ts" ? "tsx" : "jsx";
  const extConfig = language === "ts" ? "ts" : "js";
  const architecture = responses.architecture || "feature-based";
  const cssFramework = responses.cssFramework || "none";

  const fragments = [];

  // =========================================================================
  // Layer 1: Base (base provider file plan / templates/bases/<provider>/<variant>/<lang>)
  // =========================================================================
  const provider = getProvider(fw.name, fw.variant);
  const baseRel = provider ? provider.getFilePlan({ lang: language }) : null;
  const baseDir = baseRel ? path.join(templatesDir, "..", baseRel) : null;
  const packageSet = provider ? provider.getPackageSet({ options: responses }) : null;

  fragments.push({
    scope: FRAGMENT_SCOPES.BASE,
    id: `base:${fw.name}:${fw.variant}`,
    sourceDir: baseDir,
    targetDir: "",
    dependencies: packageSet?.dependencies || {},
    devDependencies: packageSet?.devDependencies || {},
  });

  // =========================================================================
  // Layer 2: Framework (entry points & default boilerplate cleanup)
  // =========================================================================
  fragments.push({
    scope: FRAGMENT_SCOPES.FRAMEWORK,
    id: `framework:${fw.name}:${fw.variant}`,
    action: async ({ projectPath }) => {
      // Remove Vite default App and CSS files before architecture overlays land
      try { await fsp.rm(path.join(projectPath, "src", "App.tsx"), { force: true }); } catch {}
      try { await fsp.rm(path.join(projectPath, "src", "App.jsx"), { force: true }); } catch {}
      try { await fsp.rm(path.join(projectPath, "src", "index.css"), { force: true }); } catch {}
      try { await fsp.rm(path.join(projectPath, "src", "App.css"), { force: true }); } catch {}
      if (fw.name === "next") {
        // Next cleanup: remove Vite defaults without touching app/
        try { await fsp.rm(path.join(projectPath, "src", "main.tsx"), { force: true }); } catch {}
        try { await fsp.rm(path.join(projectPath, "src", "main.jsx"), { force: true }); } catch {}
        try { await fsp.rm(path.join(projectPath, "index.html"), { force: true }); } catch {}
        try { await fsp.rm(path.join(projectPath, "vite.config.ts"), { force: true }); } catch {}
        try { await fsp.rm(path.join(projectPath, "vite.config.js"), { force: true }); } catch {}
        try { await fsp.rm(path.join(projectPath, "public", "vite.svg"), { force: true }); } catch {}
      }
    },
  });

  // =========================================================================
  // Layer 3: Architecture (feature-based / type-based / hybrid / none)
  // =========================================================================
  const archSrcDir = path.join(templatesDir, "architectures", architecture, "src");
  const archMainSrc = path.join(templatesDir, "architectures", architecture, `main.${ext}`);

  fragments.push({
    scope: FRAGMENT_SCOPES.ARCH,
    id: `arch:${architecture}`,
    sourceDir: archSrcDir,
    targetDir: "src",
    action: async ({ projectPath }) => {
      // Copy architecture main entry
      try {
        await fsp.access(archMainSrc);
        await fsp.copyFile(archMainSrc, path.join(projectPath, "src", `main.${ext}`));
      } catch {}
      // Remove opposite language main entry if present
      const oppositeExt = language === "ts" ? "jsx" : "tsx";
      try {
        await fsp.rm(path.join(projectPath, "src", `main.${oppositeExt}`), { force: true });
      } catch {}
    },
  });

  // =========================================================================
  // Layer 4: Styling (component styles overlay & global CSS)
  // =========================================================================
  if (cssFramework === "tailwind" || cssFramework === "bootstrap") {
    const componentStylesDir = path.join(
      templatesDir,
      "css",
      "component-styles",
      cssFramework,
      architecture,
      "src"
    );
    fragments.push({
      scope: FRAGMENT_SCOPES.STYLING,
      id: `styling:${cssFramework}:components`,
      sourceDir: componentStylesDir,
      targetDir: "src",
    });
  }

  // =========================================================================
  // Layer 5: Tooling (State, Router, Icons, API, Testing, Linter, Script, Formatter)
  // =========================================================================

  // 5.1 State Management
  if (responses.stateManagement === "redux") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "state",
      id: "tooling:state:redux",
      sourceDir: path.join(templatesDir, "conditional", "state", "redux", architecture, "src"),
      targetDir: "src",
      action: async ({ projectPath }) => {
        await updateMainWithProvider(projectPath, "redux", architecture, ext);
      },
    });
  } else if (responses.stateManagement === "zustand") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "state",
      id: "tooling:state:zustand",
      sourceDir: path.join(templatesDir, "conditional", "state", "zustand", architecture, "src"),
      targetDir: "src",
    });
  }

  // 5.2 Router (Gated by CLIENT_ROUTING capability; Next uses filesystem routing and skips)
  if (responses.router && hasCapability(fw, CAPABILITIES.CLIENT_ROUTING)) {
    const routerBaseDir = path.join(templatesDir, "conditional", "router", architecture, "src");
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "router",
      id: "tooling:router:base",
      sourceDir: routerBaseDir,
      targetDir: "src",
    });

    if (cssFramework === "tailwind" || cssFramework === "bootstrap") {
      const routerVariantDir = path.join(
        templatesDir,
        "conditional",
        "router",
        architecture,
        cssFramework,
        "src"
      );
      fragments.push({
        scope: FRAGMENT_SCOPES.TOOLING,
        category: "router",
        id: `tooling:router:${cssFramework}`,
        sourceDir: routerVariantDir,
        targetDir: "src",
      });
    }
  }

  // 5.3 Icons
  if (responses.iconLibrary && responses.iconLibrary !== "none") {
    const iconsBaseDir = path.join(
      templatesDir,
      "conditional",
      "icons",
      responses.iconLibrary,
      architecture,
      "src"
    );
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "icons",
      id: `tooling:icons:${responses.iconLibrary}:base`,
      sourceDir: iconsBaseDir,
      targetDir: "src",
    });

    if (cssFramework === "tailwind" || cssFramework === "bootstrap") {
      const iconsVariantDir = path.join(
        templatesDir,
        "conditional",
        "icons",
        responses.iconLibrary,
        architecture,
        cssFramework,
        "src"
      );
      fragments.push({
        scope: FRAGMENT_SCOPES.TOOLING,
        category: "icons",
        id: `tooling:icons:${responses.iconLibrary}:${cssFramework}`,
        sourceDir: iconsVariantDir,
        targetDir: "src",
      });
    }
  }

  // 5.4 API Client
  if (responses.apiClient === "axios" || responses.apiClient === "fetch") {
    const apiDir = path.join(
      templatesDir,
      "conditional",
      responses.apiClient,
      architecture,
      "src"
    );
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "api",
      id: `tooling:api:${responses.apiClient}`,
      sourceDir: apiDir,
      targetDir: "src",
    });
  }

  // 5.5 Testing
  if (responses.testing === "vitest" || responses.testing === "jest") {
    const testingFramework = responses.testing;
    const testingDir = path.join(templatesDir, "conditional", "testing", testingFramework);
    const testScripts =
      testingFramework === "vitest"
        ? { test: "vitest", "test:run": "vitest run" }
        : { test: "jest", "test:watch": "jest --watch" };

    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "testing",
      id: `tooling:testing:${testingFramework}`,
      scripts: testScripts,
      action: async ({ projectPath }) => {
        // Config file to project root
        if (testingFramework === "jest" && fw.name === "next") {
          const nextConfigExt = language === "ts" ? "ts" : "mjs";
          const configSrc = path.join(testingDir, "next", `jest.config.${nextConfigExt}`);
          try {
            await fsp.access(configSrc);
            await fsp.copyFile(configSrc, path.join(projectPath, `jest.config.${nextConfigExt}`));
          } catch {}
        } else {
          const configSrc = path.join(testingDir, `${testingFramework}.config.${extConfig}`);
          try {
            await fsp.access(configSrc);
            await fsp.copyFile(configSrc, path.join(projectPath, `${testingFramework}.config.${extConfig}`));
          } catch {}
        }

        // Setup file to src/test/setup.*
        const setupSrc = path.join(testingDir, `src/test/setup.${extConfig}`);
        try {
          await fsp.access(setupSrc);
          const setupDest = path.join(projectPath, "src", "test", `setup.${extConfig}`);
          await writeFileRecursive(setupDest, await fsp.readFile(setupSrc, "utf8"));
        } catch {}

        if (testingFramework === "jest") {
          const jestSetupSrc = path.join(testingDir, `jest.setup.${extConfig}`);
          try {
            await fsp.access(jestSetupSrc);
            await fsp.copyFile(jestSetupSrc, path.join(projectPath, `jest.setup.${extConfig}`));
          } catch {}
          if (fw.name !== "next") {
            const babelSrc = path.join(testingDir, "babel.config.cjs");
            try {
              await fsp.access(babelSrc);
              await fsp.copyFile(babelSrc, path.join(projectPath, "babel.config.cjs"));
            } catch {}
          }
        }

        if (fw.name === "next") {
          const testFileName = fw.variant === "pages-router" ? "index" : "page";
          const testSrc = path.join(
            testingDir,
            "next",
            fw.variant,
            "src",
            "__tests__",
            `${testFileName}.test.${ext}`
          );
          try {
            await fsp.access(testSrc);
            const testDest = path.join(projectPath, "src", "__tests__", `${testFileName}.test.${ext}`);
            await writeFileRecursive(testDest, await fsp.readFile(testSrc, "utf8"));
          } catch {}
        } else {
          // Architecture-scoped test file
          const testSrc = path.join(testingDir, architecture, `src/__tests__/App.test.${ext}`);
          try {
            await fsp.access(testSrc);
            const testDest = path.join(projectPath, "src", "__tests__", `App.test.${ext}`);
            await writeFileRecursive(testDest, await fsp.readFile(testSrc, "utf8"));
          } catch {}
        }
      },
    });
  }

  // 5.6 Linter
  if (responses.linter === "eslint") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "linter",
      id: "tooling:linter:eslint",
      scripts: {
        lint: "eslint .",
        "lint:fix": "eslint . --fix",
      },
      action: async ({ projectPath }) => {
        const lintingDir = path.join(templatesDir, "conditional", "linting", "eslint");
        if (fw.name === "next") {
          const configSrc = path.join(lintingDir, "next", "eslint.config.mjs");
          try {
            await fsp.access(configSrc);
            await fsp.copyFile(configSrc, path.join(projectPath, "eslint.config.mjs"));
          } catch {}
        } else {
          const configSrc = path.join(lintingDir, `eslint.config.${extConfig}`);
          try {
            await fsp.access(configSrc);
            await fsp.copyFile(configSrc, path.join(projectPath, `eslint.config.${extConfig}`));
          } catch {}
        }
      },
    });
  } else if (responses.linter === "oxlint") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "linter",
      id: "tooling:linter:oxlint",
      scripts: {
        lint: "oxlint .",
      },
      action: async ({ projectPath }) => {
        const configSrc = path.join(templatesDir, "conditional", "linting", "oxlint", "oxlintrc.json");
        try {
          await fsp.access(configSrc);
          await fsp.copyFile(configSrc, path.join(projectPath, "oxlintrc.json"));
        } catch {}
      },
    });
  } else if (responses.linter === "biome") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "linter",
      id: "tooling:linter:biome",
      scripts: {
        lint: "biome check .",
        "lint:fix": "biome check --write .",
      },
      action: async ({ projectPath }) => {
        const configSrc = path.join(templatesDir, "conditional", "linting", "biome", "biome.json");
        try {
          await fsp.access(configSrc);
          await fsp.copyFile(configSrc, path.join(projectPath, "biome.json"));
        } catch {}
      },
    });
  }

  // 5.7 Feature Script (Feature-based only)
  if (architecture === "feature-based") {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "feature-script",
      id: "tooling:feature-script",
      scripts: {
        "create:feature": "node scripts/create-feature.mjs",
      },
      action: async ({ projectPath }) => {
        const scriptSrc = path.join(templatesDir, "architectures", "feature-based", "scripts", "create-feature.mjs");
        const scriptDest = path.join(projectPath, "scripts", "create-feature.mjs");
        try {
          await fsp.access(scriptSrc);
          let content = await fsp.readFile(scriptSrc, "utf8");
          if (language === "js") {
            content = content
              .replace(/services\/index\.ts/g, "services/index.js")
              .replace(/store\/index\.ts/g, "store/index.js")
              .replace(/hooks\/index\.ts/g, "hooks/index.js")
              .replace(/pages\/index\.ts/g, "pages/index.js")
              .replace(/types\/index\.ts/g, "types/index.js");
          }
          await writeFileRecursive(scriptDest, content);
        } catch {}
      },
    });
  }

  // 5.75 Next.js Configuration & Adapter Overlays
  if (fw.name === "next") {
    const nextScripts = {};
    if (responses.bundler === "turbopack") {
      nextScripts.dev = "next dev --turbopack";
    } else if (responses.bundler === "webpack") {
      nextScripts.dev = "next dev --webpack";
    }

    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "next-config",
      id: "tooling:next:config",
      scripts: nextScripts,
      action: async ({ projectPath }) => {
        const configExt = language === "ts" ? "ts" : "mjs";

        // Apply adapter overlay if specified and not "none"
        if (responses.adapter && responses.adapter !== "none") {
          const adapterConfigSrc = path.join(
            templatesDir,
            "conditional",
            "next",
            "config",
            responses.adapter,
            `next.config.${configExt}`
          );
          try {
            await fsp.access(adapterConfigSrc);
            await fsp.copyFile(adapterConfigSrc, path.join(projectPath, `next.config.${configExt}`));
          } catch {}
        } else if (responses.bundler === "turbopack" || responses.bundler === "webpack") {
          // If no adapter specified, but bundler config overlay exists, apply bundler overlay
          const bundlerConfigSrc = path.join(
            templatesDir,
            "conditional",
            "next",
            "config",
            responses.bundler,
            `next.config.${configExt}`
          );
          try {
            await fsp.access(bundlerConfigSrc);
            await fsp.copyFile(bundlerConfigSrc, path.join(projectPath, `next.config.${configExt}`));
          } catch {}
        }

        // Apply reactCompiler flag to next.config if enabled
        if (responses.reactCompiler === true) {
          const targetConfigPath = path.join(projectPath, `next.config.${configExt}`);
          try {
            let content = await fsp.readFile(targetConfigPath, "utf8");
            if (!content.includes("reactCompiler")) {
              content = content.replace(
                /const nextConfig(?::\s*NextConfig)?\s*=\s*\{/,
                (match) => `${match}\n  reactCompiler: true,`
              );
              await fsp.writeFile(targetConfigPath, content, "utf8");
            }
          } catch {}
        }

        // Apply standalone output to next.config if docker is enabled
        if (responses.docker === true) {
          const targetConfigPath = path.join(projectPath, `next.config.${configExt}`);
          try {
            let content = await fsp.readFile(targetConfigPath, "utf8");
            if (!content.includes('"standalone"') && !content.includes("'standalone'")) {
              content = content.replace(
                /const nextConfig(?::\s*NextConfig)?\s*=\s*\{/,
                (match) => `${match}\n  output: "standalone",`
              );
              await fsp.writeFile(targetConfigPath, content, "utf8");
            }
          } catch {}
        }
      },
    });
  }

  // 5.8 Docker (Multi-stage Dockerfile and docker-compose for Next.js standalone)
  if (responses.docker === true && hasCapability(fw, CAPABILITIES.DOCKER)) {
    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "docker",
      id: "tooling:docker",
      action: async ({ projectPath }) => {
        const dockerSrcDir = path.join(templatesDir, "conditional", "docker");
        const filesToCopy = ["Dockerfile", ".dockerignore", "docker-compose.yml"];
        for (const file of filesToCopy) {
          const srcFile = path.join(dockerSrcDir, file);
          const destFile = path.join(projectPath, file);
          try {
            await fsp.access(srcFile);
            await fsp.copyFile(srcFile, destFile);
          } catch {}
        }
      },
    });
  }

  // 5.9 Formatter
  if (responses.formatter && responses.formatter !== "none") {
    const isPrettier = responses.formatter === "prettier";
    const configFile = isPrettier ? ".prettierrc" : ".oxfmtrc.json";
    const formatScripts = isPrettier
      ? { format: "prettier --write .", "format:check": "prettier --check ." }
      : { format: "oxfmt .", "format:check": "oxfmt --check ." };

    fragments.push({
      scope: FRAGMENT_SCOPES.TOOLING,
      category: "formatter",
      id: `tooling:formatter:${responses.formatter}`,
      scripts: formatScripts,
      action: async ({ projectPath }) => {
        const configSrc = path.join(
          templatesDir,
          "conditional",
          "formatter",
          responses.formatter,
          configFile
        );
        try {
          await fsp.access(configSrc);
          await fsp.copyFile(configSrc, path.join(projectPath, configFile));
        } catch {}

        if (responses.linter === "eslint" && responses.formatter === "prettier") {
          await wireEslintPrettier(projectPath, language, fw.name);
        }
      },
    });
  }

  return sortFragments(fragments);
}

/**
 * Deterministically sort fragments by FRAGMENT_PRECEDENCE and TOOLING_ORDER.
 * @param {Array<object>} fragments
 * @returns {Array<object>}
 */
export function sortFragments(fragments) {
  return [...fragments].sort((a, b) => {
    const aScopeIdx = FRAGMENT_PRECEDENCE.indexOf(a.scope);
    const bScopeIdx = FRAGMENT_PRECEDENCE.indexOf(b.scope);
    if (aScopeIdx !== bScopeIdx) {
      return aScopeIdx - bScopeIdx;
    }
    // Both are tooling: sort by TOOLING_ORDER
    if (a.scope === FRAGMENT_SCOPES.TOOLING && b.scope === FRAGMENT_SCOPES.TOOLING) {
      const aCatIdx = TOOLING_ORDER.indexOf(a.category || "");
      const bCatIdx = TOOLING_ORDER.indexOf(b.category || "");
      if (aCatIdx !== bCatIdx) {
        return aCatIdx - bCatIdx;
      }
    }
    return (a.id || "").localeCompare(b.id || "");
  });
}

/**
 * Apply a list of fragments to a project in deterministic precedence order.
 *
 * @param {string} projectPath
 * @param {Array<object>} fragments
 * @param {object} options
 */
export async function applyFragments(projectPath, fragments, options = {}) {
  const language = options.language || "ts";
  const filter = langFileFilter(language);

  // Collect scripts to merge into package.json in one deterministic pass
  const pendingScripts = {};

  for (const fragment of fragments) {
    // 1. Copy directory contents if sourceDir is provided and exists
    if (fragment.sourceDir) {
      try {
        await fsp.access(fragment.sourceDir);
        const target = fragment.targetDir
          ? path.join(projectPath, fragment.targetDir)
          : projectPath;
        await copyDirRecursive(fragment.sourceDir, target, filter);
      } catch {
        // Source dir does not exist, continue
      }
    }

    // 2. Execute fragment action if provided
    if (typeof fragment.action === "function") {
      await fragment.action({
        projectPath,
        templatesDir: options.templatesDir,
        responses: options.responses,
        ext: language === "ts" ? "tsx" : "jsx",
        language,
      });
    }

    // 3. Queue scripts
    if (fragment.scripts) {
      Object.assign(pendingScripts, fragment.scripts);
    }
  }

  // 4. Merge scripts into package.json
  if (Object.keys(pendingScripts).length > 0) {
    const pkgPath = path.join(projectPath, "package.json");
    try {
      const content = await fsp.readFile(pkgPath, "utf8");
      const pkg = JSON.parse(content);
      if (!pkg.scripts) pkg.scripts = {};
      for (const [key, val] of Object.entries(pendingScripts)) {
        pkg.scripts[key] = val;
      }
      await fsp.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    } catch {}
  }

  // 5. Prune redundant .gitkeep placeholders
  await pruneRedundantGitkeeps(projectPath);
}

/**
 * Helper to update main entry with Redux StoreProvider.
 */
async function updateMainWithProvider(projectPath, stateType, architecture, ext) {
  const mainPath = path.join(projectPath, "src", `main.${ext}`);
  try {
    let content = await fsp.readFile(mainPath, "utf8");

    if (architecture === "feature-based") {
      if (!content.includes("StoreProvider")) {
        content = content.replace(
          /import App from ['"]@\/app\/App['"]\n?/,
          "import App from '@/app/App'\nimport { StoreProvider } from '@/app/providers/StoreProvider'\n"
        );
        content = content.replace(
          /<App \/>/,
          "<StoreProvider>\n        <App />\n      </StoreProvider>"
        );
      }
    } else {
      if (!content.includes("StoreProvider")) {
        content = content.replace(
          /import App from ['"]\.\/App['"]\n?/,
          "import App from './App'\nimport { StoreProvider } from './providers/StoreProvider'\n"
        );
        content = content.replace(
          /<App \/>/,
          "<StoreProvider>\n        <App />\n      </StoreProvider>"
        );
      }
    }

    await fsp.writeFile(mainPath, content, "utf8");
  } catch {}
}

/**
 * Helper to wire eslint-config-prettier into eslint configuration.
 */
async function wireEslintPrettier(projectPath, language, framework) {
  const ext = framework === "next" ? "mjs" : language === "ts" ? "ts" : "js";
  const eslintConfigPath = path.join(projectPath, `eslint.config.${ext}`);
  try {
    let content = await fsp.readFile(eslintConfigPath, "utf8");

    if (content.includes("eslint-config-prettier")) return;

    const lines = content.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportIdx = i;
    }
    lines.splice(
      lastImportIdx + 1,
      0,
      'import prettier from "eslint-config-prettier";'
    );

    let result = lines.join("\n");
    const pushLast = (_, head, tail) =>
      head.replace(/,\s*$/, "") + ",\n  prettier," + tail;

    if (result.includes("tseslint.config(")) {
      result = result.replace(
        /(export default tseslint\.config\([\s\S]*?)(\n\s*\);)/,
        pushLast
      );
    } else if (result.includes("const eslintConfig = [")) {
      result = result.replace(
        /(const eslintConfig = \[[\s\S]*?)(\n\s*\];)/,
        pushLast
      );
    } else {
      result = result.replace(
        /(export default \[[\s\S]*?)(\n\s*\];)/,
        pushLast
      );
    }

    await fsp.writeFile(eslintConfigPath, result, "utf8");
  } catch {}
}
