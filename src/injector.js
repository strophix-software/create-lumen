import { promises as fsp } from "fs";
import path from "path";
import {
  FRAGMENT_SCOPES,
  resolveFragments,
  applyFragments,
  langFileFilter,
  pruneRedundantGitkeeps,
} from "./engine/composition.js";

export {
  FRAGMENT_SCOPES,
  resolveFragments,
  applyFragments,
  langFileFilter,
  pruneRedundantGitkeeps,
};

/**
 * Inject architecture templates into projectPath from composed fragments.
 * Composes framework entry points, architecture layout, and styling component overlays.
 *
 * @param {string} projectPath
 * @param {string} templatesDir
 * @param {string} architecture
 * @param {string} language
 * @param {string} cssFramework
 */
export async function injectArchitecture(
  projectPath,
  templatesDir,
  architecture,
  language,
  cssFramework,
  frameworkOptions = {}
) {
  const fwObj =
    typeof frameworkOptions === "object" && frameworkOptions !== null
      ? frameworkOptions
      : typeof frameworkOptions === "string"
      ? { frameworkName: frameworkOptions }
      : {};
  const responses = { architecture, language, cssFramework, ...fwObj };
  const allFragments = resolveFragments(responses, templatesDir);
  const archFragments = allFragments.filter(
    (f) =>
      f.scope === FRAGMENT_SCOPES.FRAMEWORK ||
      f.scope === FRAGMENT_SCOPES.ARCH ||
      f.scope === FRAGMENT_SCOPES.STYLING
  );
  await applyFragments(projectPath, archFragments, {
    language,
    templatesDir,
    responses,
  });
}

/**
 * Inject code formatter configuration and wiring from composed fragments.
 *
 * @param {string} projectPath
 * @param {string} templatesDir
 * @param {object} responses
 */
export async function injectFormatter(projectPath, templatesDir, responses) {
  if (!responses.formatter || responses.formatter === "none") return;
  const allFragments = resolveFragments(responses, templatesDir);
  const formatterFragments = allFragments.filter(
    (f) => f.scope === FRAGMENT_SCOPES.TOOLING && f.category === "formatter"
  );
  await applyFragments(projectPath, formatterFragments, {
    language: responses.language,
    templatesDir,
    responses,
  });
}

/**
 * Inject conditional tooling features (state, router, icons, api client, testing, linter, scripts)
 * using the composed fragment pipeline.
 *
 * @param {string} projectPath
 * @param {string} templatesDir
 * @param {object} responses
 * @param {string} architecture
 * @param {string} language
 */
export async function injectConditionals(
  projectPath,
  templatesDir,
  responses,
  architecture,
  language
) {
  const mergedResponses = { ...responses, architecture, language };
  const allFragments = resolveFragments(mergedResponses, templatesDir);
  const conditionalFragments = allFragments.filter(
    (f) => f.scope === FRAGMENT_SCOPES.TOOLING && f.category !== "formatter"
  );
  await applyFragments(projectPath, conditionalFragments, {
    language,
    templatesDir,
    responses: mergedResponses,
  });

  // 8. UI Kit (shadcn gated to tailwind) — applied after fragments so its
  // components.json, cn helper and primitives land on the composed tree.
  await injectUiKit(projectPath, templatesDir, mergedResponses, architecture, language);
}

/**
 * Inject linter configuration and package scripts using the composed fragment pipeline.
 *
 * @param {string} projectPath
 * @param {string} templatesDir
 * @param {string} linter
 * @param {string} language
 * @param {string|object} framework
 */
export async function injectLinter(
  projectPath,
  templatesDir,
  linter,
  language,
  framework
) {
  const responses = { linter, language, framework };
  const allFragments = resolveFragments(responses, templatesDir);
  const linterFragments = allFragments.filter(
    (f) => f.scope === FRAGMENT_SCOPES.TOOLING && f.category === "linter"
  );
  await applyFragments(projectPath, linterFragments, {
    language,
    templatesDir,
    responses,
  });
}

/**
 * High-level composition API: inject all capability fragments in documented precedence order.
 *
 * @param {string} projectPath
 * @param {string} templatesDir
 * @param {object} responses
 */
export async function injectComposedFragments(projectPath, templatesDir, responses) {
  const fragments = resolveFragments(responses, templatesDir);
  await applyFragments(projectPath, fragments, {
    language: responses.language,
    templatesDir,
    responses,
  });
}

export function getComponentsJson({
  framework = "vite",
  architecture = "feature-based",
  language = "ts",
}) {
  const isNext = framework === "next";
  const isTs = language === "ts";

  if (isNext) {
    // Next App Router contract stub
    return {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "new-york",
      rsc: true,
      tsx: isTs,
      tailwind: {
        config: "",
        css: "app/globals.css",
        baseColor: "neutral",
        cssVariables: true,
        prefix: "",
      },
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      iconLibrary: "lucide",
    };
  }

  const isFeatureBased = architecture === "feature-based";
  return {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: isTs,
    tailwind: {
      config: "",
      css: isFeatureBased
        ? "src/shared/styles/globals.css"
        : "src/styles/globals.css",
      baseColor: "neutral",
      cssVariables: true,
      prefix: "",
    },
    aliases: isFeatureBased
      ? {
          components: "@/shared/components",
          utils: "@/lib/utils",
          ui: "@/shared/components/ui",
          lib: "@/lib",
          hooks: "@/shared/hooks",
        }
      : {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/ui",
          lib: "@/lib",
          hooks: "@/hooks",
        },
    iconLibrary: "lucide",
  };
}

export async function injectUiKit(
  projectPath,
  templatesDir,
  responses,
  architecture,
  language
) {
  const uiKit = responses.uiKit || responses.ui?.kit || responses.ui || "none";
  if (uiKit !== "shadcn") return;

  if (responses.cssFramework !== "tailwind") {
    throw new Error(
      `ui.kit "shadcn" requires styling.engine "tailwind" (got "${responses.cssFramework}")`
    );
  }

  const isTs = language === "ts";
  const codeExt = isTs ? "tsx" : "jsx";
  const utilExt = isTs ? "ts" : "js";
  const framework = responses.framework || responses.frameworkName || "vite";

  // 1. Write components.json
  const componentsJson = getComponentsJson({
    framework,
    architecture,
    language,
  });
  await fsp.writeFile(
    path.join(projectPath, "components.json"),
    JSON.stringify(componentsJson, null, 2) + "\n",
    "utf8"
  );

  // 2. Write cn helper to src/lib/utils.{ts,js}
  const libDir = path.join(projectPath, "src", "lib");
  await fsp.mkdir(libDir, { recursive: true });
  const utilsSrc = path.join(
    templatesDir,
    "ui",
    "shadcn",
    "lib",
    `utils.${utilExt}`
  );
  const utilsDest = path.join(libDir, `utils.${utilExt}`);
  try {
    await fsp.access(utilsSrc);
    await fsp.copyFile(utilsSrc, utilsDest);
  } catch {
    const code = isTs
      ? `import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`
      : `import { clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs) {\n  return twMerge(clsx(inputs));\n}\n`;
    await fsp.writeFile(utilsDest, code, "utf8");
  }

  // Also sync architecture's cn helper if present
  if (architecture === "feature-based") {
    const sharedUtilsDir = path.join(projectPath, "src", "shared", "utils");
    await fsp.mkdir(sharedUtilsDir, { recursive: true });
    await fsp.copyFile(utilsDest, path.join(sharedUtilsDir, `cn.${codeExt === "tsx" ? "ts" : "jsx"}`));
  } else {
    const typeUtilsDir = path.join(projectPath, "src", "utils");
    await fsp.mkdir(typeUtilsDir, { recursive: true });
    await fsp.copyFile(utilsDest, path.join(typeUtilsDir, `cn.${codeExt === "tsx" ? "ts" : "jsx"}`));
  }

  // 3. Inject Button and Card primitives
  const isFeatureBased = architecture === "feature-based";
  const targetUiDir = isFeatureBased
    ? path.join(projectPath, "src", "shared", "components", "ui")
    : path.join(projectPath, "src", "ui");

  await fsp.mkdir(targetUiDir, { recursive: true });

  const buttonDest = path.join(targetUiDir, `Button.${codeExt}`);
  const cardDest = path.join(targetUiDir, `Card.${codeExt}`);
  const indexDest = path.join(targetUiDir, `index.${utilExt}`);

  const buttonTemplate = path.join(
    templatesDir,
    "ui",
    "shadcn",
    "primitives",
    `Button.${codeExt}`
  );
  const cardTemplate = path.join(
    templatesDir,
    "ui",
    "shadcn",
    "primitives",
    `Card.${codeExt}`
  );
  const indexTemplate = path.join(
    templatesDir,
    "ui",
    "shadcn",
    "primitives",
    `index.${utilExt}`
  );

  try {
    await fsp.access(buttonTemplate);
    await fsp.copyFile(buttonTemplate, buttonDest);
  } catch {}

  try {
    await fsp.access(cardTemplate);
    await fsp.copyFile(cardTemplate, cardDest);
  } catch {}

  try {
    await fsp.access(indexTemplate);
    await fsp.copyFile(indexTemplate, indexDest);
  } catch {}

  // If type-based, also populate src/components/ui for maximum tooling compatibility
  if (!isFeatureBased) {
    const fallbackUiDir = path.join(projectPath, "src", "components", "ui");
    await fsp.mkdir(fallbackUiDir, { recursive: true });
    try {
      await fsp.copyFile(buttonDest, path.join(fallbackUiDir, `Button.${codeExt}`));
      await fsp.copyFile(cardDest, path.join(fallbackUiDir, `Card.${codeExt}`));
      await fsp.copyFile(indexDest, path.join(fallbackUiDir, `index.${utilExt}`));
    } catch {}
  }
}

