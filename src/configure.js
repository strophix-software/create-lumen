import { promises as fsp } from "fs";
import path from "path";
import { readFileContent } from "@/utils/fs.js";
import { getPathAliases, getViteAliases } from "@/aliases.js";
import { normalizeFramework } from "@/engine/capabilities.js";

export async function configureProject(projectPath, language, cssFramework, framework = "vite") {
  const fw = normalizeFramework(framework);
  const ext = language === "ts" ? "ts" : "js";

  if (fw.name === "next") {
    // Next.js ships its own tsconfig.json with next plugins and paths.
    // Skip Vite tsconfig.app.json and vite.config mutations.
    await configurePackageJson(projectPath, language);
    return;
  }

  // Set up tsconfig/jsconfig with the @/* path alias
  if (language === "ts") {
    await configureTsconfig(projectPath);
  } else {
    await configureJsconfig(projectPath);
  }

  // Add path aliases to vite.config for non-tailwind setups
  if (cssFramework !== "tailwind") {
    await addPathAliasesToViteConfig(projectPath, ext);
  }

  // Add scripts to package.json
  await configurePackageJson(projectPath, language);
}

async function configureTsconfig(projectPath) {
  const paths = getPathAliases();
  // Create/update tsconfig.app.json with paths
  const tsconfigAppPath = path.join(projectPath, "tsconfig.app.json");
  try {
    const content = await readFileContent(tsconfigAppPath);
    const config = JSON.parse(content);

    if (!config.compilerOptions) config.compilerOptions = {};
    config.compilerOptions.strict = true;
    config.compilerOptions.paths = paths;
    if (config.compilerOptions.types?.length && !config.compilerOptions.types.includes("vite/client")) {
      config.compilerOptions.types.push("vite/client");
    } else if (!config.compilerOptions.types) {
      config.compilerOptions.types = ["vite/client"];
    }

    await fsp.writeFile(
      tsconfigAppPath,
      JSON.stringify(config, null, 2) + "\n",
      "utf8"
    );
  } catch {
    // Create tsconfig.app.json if it doesn't exist
    const config = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        types: ["vite/client"],
        paths,
      },
      include: ["src"],
    };
    await fsp.writeFile(
      tsconfigAppPath,
      JSON.stringify(config, null, 2) + "\n",
      "utf8"
    );
  }

  // Create/update root tsconfig.json with references.
  // Preserve the ./tsconfig.node.json reference (Vite config) when present.
  const rootTsconfigPath = path.join(projectPath, "tsconfig.json");
  const nodeConfigPath = path.join(projectPath, "tsconfig.node.json");
  const references = [{ path: "./tsconfig.app.json" }];
  try {
    await fsp.access(nodeConfigPath);
    references.push({ path: "./tsconfig.node.json" });
  } catch {}

  const rootTsconfig = {
    files: [],
    references,
    compilerOptions: {
      baseUrl: ".",
      paths,
    },
  };
  await fsp.writeFile(
    rootTsconfigPath,
    JSON.stringify(rootTsconfig, null, 2) + "\n",
    "utf8"
  );
}

async function configureJsconfig(projectPath) {
  const jsconfigPath = path.join(projectPath, "jsconfig.json");
  const config = {
    compilerOptions: {
      baseUrl: ".",
      paths: getPathAliases(),
    },
    include: ["src"],
  };
  await fsp.writeFile(jsconfigPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

async function addPathAliasesToViteConfig(projectPath, ext) {
  const viteConfigPath = path.join(projectPath, `vite.config.${ext}`);
  try {
    let content = await readFileContent(viteConfigPath);

    if (content.includes("find: '@'")) return;

    const lines = content.split("\n");

    // Find where imports end (last import line index)
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportIdx = i;
    }

    // Insert path/fileURLToPath imports after last import
    const newImports = [
      "import path from 'path';",
      "import { fileURLToPath } from 'url';",
      "const __dirname = path.dirname(fileURLToPath(import.meta.url));",
    ];
    lines.splice(lastImportIdx + 1, 0, ...newImports);

    let result = lines.join("\n");

    const aliasArray = getViteAliases()
      .map((a) => `{ find: '${a.find}', replacement: ${a.replacement} }`)
      .join(",\n      ");

    const resolveBlock = `resolve: {\n    alias: [\n      ${aliasArray},\n    ],\n  }`;

    if (result.includes("resolve:")) {
      result = result.replace(/resolve:\s*\{/, resolveBlock);
    } else {
      result = result.replace(
        /defineConfig\(\{/,
        `defineConfig({\n  ${resolveBlock},`
      );
    }

    await fsp.writeFile(viteConfigPath, result, "utf8");
  } catch {
    // file doesn't exist, skip
  }
}

async function configurePackageJson(projectPath, language) {
  const pkgPath = path.join(projectPath, "package.json");
  try {
    const content = await readFileContent(pkgPath);
    const pkg = JSON.parse(content);

    if (!pkg.scripts) pkg.scripts = {};

    // Fill defaults only — never overwrite scripts owned by the base template
    // (Next.js bases ship next dev/build/start) or merged overlay fragments
    // (e.g. the bundler-aware dev script). React/Vite bases already carry the
    // vite commands, so this is a no-op there too.
    pkg.scripts.dev ??= "vite";
    pkg.scripts.build ??= "vite build";
    pkg.scripts.preview ??= "vite preview";

    if (language === "ts") {
      pkg.scripts.typecheck ??= "tsc -b";
    }

    await fsp.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  } catch {
    // file doesn't exist, skip
  }
}
