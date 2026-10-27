import { execa } from "execa";
import { normalizeFramework } from "./engine/capabilities.js";

export async function installDeps(pkgManager, dev, packages, cwd) {
  let cmd, args;
  switch (pkgManager) {
    case "pnpm":
      cmd = "pnpm";
      args = dev ? ["add", "-D", ...packages] : ["add", ...packages];
      break;
    case "yarn":
      cmd = "yarn";
      args = dev ? ["add", "-D", ...packages] : ["add", ...packages];
      break;
    case "bun":
      cmd = "bun";
      args = dev ? ["add", "-d", ...packages] : ["add", ...packages];
      break;
    default:
      cmd = "npm";
      args = dev
        ? ["install", "-D", ...packages]
        : ["install", ...packages];
  }
  await execa(cmd, args, { stdio: "pipe", cwd });
}

export async function installAllDeps(responses, pkg, cwd) {
  const { deps, devDepBatches } = computeDeps(responses);

  if (deps.length > 0) {
    await installDeps(pkg, false, deps, cwd);
  }
  for (const batch of devDepBatches) {
    await installDeps(pkg, true, batch, cwd);
  }
}

// Pure dependency computation — the package list for a given matrix cell,
// independent of any package manager or filesystem. Unit-tested directly so
// the conditional wiring stays verifiable without a network install.
export function computeDeps(responses) {
  const deps = [];
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );
  const fwName = fw.name;
  const cssDevDeps = [];
  const databaseDevDeps = [];
  const testingDevDeps = [];
  const linterDevDeps = [];
  const formatterDevDeps = [];

  // CSS framework
  if (responses.cssFramework === "tailwind") {
    if (fwName === "next") {
      cssDevDeps.push("tailwindcss", "@tailwindcss/postcss", "postcss");
    } else {
      cssDevDeps.push("tailwindcss", "@tailwindcss/vite");
    }
    deps.push("clsx", "tailwind-merge");
  }

  // State management
  if (responses.stateManagement === "redux") {
    deps.push("@reduxjs/toolkit", "react-redux");
  } else if (responses.stateManagement === "zustand") {
    deps.push("zustand");
  }

  // Router
  if (responses.router) {
    deps.push("react-router-dom");
  }

  // Icons
  if (responses.iconLibrary === "lucide") {
    deps.push("lucide-react");
  } else if (responses.iconLibrary === "huge") {
    deps.push("@hugeicons/react", "@hugeicons/core-free-icons");
  }

  // API Client
  if (responses.apiClient === "axios") {
    deps.push("axios");
  }

  // Database
  if (responses.database === "prisma") {
    deps.push("@prisma/client@^6");
    databaseDevDeps.push("prisma@^6");
    if (responses.language === "ts") {
      databaseDevDeps.push("tsx");
    }
  }

  // Testing
  if (responses.testing === "vitest") {
    testingDevDeps.push(
      "vitest",
      "@testing-library/react",
      "@testing-library/jest-dom",
      "jsdom"
    );
  } else if (responses.testing === "jest") {
    if (fwName === "next") {
      testingDevDeps.push(
        "jest",
        "jest-environment-jsdom",
        "@testing-library/react",
        "@testing-library/jest-dom"
      );
      if (responses.language === "ts") {
        testingDevDeps.push("@types/jest");
      }
    } else {
      testingDevDeps.push(
        "jest",
        "jest-environment-jsdom",
        "@testing-library/react",
        "@testing-library/jest-dom",
        "jsdom",
        "babel-jest",
        "@babel/preset-env",
        "@babel/preset-react",
        "@babel/preset-typescript"
      );
    }
  }

  // Linter
  if (responses.linter === "eslint") {
    if (fwName === "next") {
      linterDevDeps.push("eslint", "eslint-config-next");
    } else {
      linterDevDeps.push("eslint", "@eslint/js", "eslint-plugin-react-hooks", "eslint-plugin-react-refresh", "globals");
      if (responses.language === "ts") {
        linterDevDeps.push("typescript-eslint", "jiti");
      }
    }
  } else if (responses.linter === "oxlint") {
    linterDevDeps.push("oxlint");
  } else if (responses.linter === "biome") {
    linterDevDeps.push("@biomejs/biome");
  }

  // Formatter
  if (responses.formatter === "prettier") {
    formatterDevDeps.push("prettier");
    if (responses.linter === "eslint") {
      formatterDevDeps.push("eslint-config-prettier");
    }
  } else if (responses.formatter === "oxfmt") {
    formatterDevDeps.push("oxfmt");
  }

  // Always re-install react + react-dom for consistency
  deps.push("react", "react-dom");

  const devDepBatches = [
    cssDevDeps,
    databaseDevDeps,
    testingDevDeps,
    linterDevDeps,
    formatterDevDeps,
  ].filter((batch) => batch.length > 0);

  const devDeps = devDepBatches.flat();

  return { deps, devDeps, devDepBatches };
}
