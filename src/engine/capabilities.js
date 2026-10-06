/**
 * Capability declaration model for create-lumen v2 generator engine.
 * Decouples option compatibility from hardcoded generator checks.
 * Covered under create-lumen#25 (ADR 0001).
 */

export const CAPABILITIES = {
  CLIENT_ROUTING: "client-routing",
  FILESYSTEM_ROUTING: "filesystem-routing",
  SERVER_COMPONENTS: "server-components",
  CLIENT_COMPONENTS: "client-components",
  ROUTE_HANDLERS: "route-handlers",
  API_ROUTES: "api-routes",
  ADAPTERS: "adapters",
  BUNDLER_SELECTION: "bundler-selection",
  REACT_COMPILER: "react-compiler",
  NEXT_FONT: "next-font",
  NEXT_IMAGE: "next-image",
  SPA_FALLBACK: "spa-fallback",
  AGENT_DOCS: "agent-docs",
};

export const FRAMEWORK_CAPABILITIES = {
  "react:vite": {
    framework: { name: "react", variant: "vite" },
    capabilities: [
      CAPABILITIES.CLIENT_ROUTING,
      CAPABILITIES.CLIENT_COMPONENTS,
      CAPABILITIES.SPA_FALLBACK,
      CAPABILITIES.AGENT_DOCS,
    ],
    allowedArchitectures: ["feature-based", "type-based", "none"],
    allowedStyling: ["tailwind", "none"],
    allowedUiKits: ["shadcn", "none"],
    allowedLanguages: ["ts", "js"],
    allowedLinters: ["eslint", "oxlint", "biome", "none"],
    allowedFormatters: ["prettier", "oxfmt", "none"],
    allowedBundlers: [],
    allowedAdapters: [],
    supportsRouterPrompt: true,
  },
  "next:app-router": {
    framework: { name: "next", variant: "app-router" },
    capabilities: [
      CAPABILITIES.FILESYSTEM_ROUTING,
      CAPABILITIES.SERVER_COMPONENTS,
      CAPABILITIES.CLIENT_COMPONENTS,
      CAPABILITIES.ROUTE_HANDLERS,
      CAPABILITIES.ADAPTERS,
      CAPABILITIES.BUNDLER_SELECTION,
      CAPABILITIES.REACT_COMPILER,
      CAPABILITIES.NEXT_FONT,
      CAPABILITIES.NEXT_IMAGE,
      CAPABILITIES.AGENT_DOCS,
    ],
    allowedArchitectures: ["feature-based", "hybrid", "none"],
    allowedStyling: ["tailwind", "none"],
    allowedUiKits: ["shadcn", "none"],
    allowedLanguages: ["ts", "js"],
    allowedLinters: ["eslint", "biome", "none"],
    allowedFormatters: ["prettier", "none"],
    allowedBundlers: ["turbopack", "webpack"],
    allowedAdapters: ["node", "vercel", "cloudflare", "static"],
    supportsRouterPrompt: false, // filesystem routing is built-in
  },
  "next:pages-router": {
    framework: { name: "next", variant: "pages-router" },
    capabilities: [
      CAPABILITIES.FILESYSTEM_ROUTING,
      CAPABILITIES.CLIENT_COMPONENTS,
      CAPABILITIES.API_ROUTES,
      CAPABILITIES.ADAPTERS,
      CAPABILITIES.BUNDLER_SELECTION,
      CAPABILITIES.NEXT_FONT,
      CAPABILITIES.NEXT_IMAGE,
      CAPABILITIES.AGENT_DOCS,
    ],
    allowedArchitectures: ["feature-based", "hybrid", "none"],
    allowedStyling: ["tailwind", "none"],
    allowedUiKits: ["shadcn", "none"],
    allowedLanguages: ["ts", "js"],
    allowedLinters: ["eslint", "biome", "none"],
    allowedFormatters: ["prettier", "none"],
    allowedBundlers: ["turbopack", "webpack"],
    allowedAdapters: ["node", "vercel", "cloudflare", "static"],
    supportsRouterPrompt: false, // filesystem routing is built-in
  },
};

/**
 * Get canonical framework lookup key.
 * @param {string} name
 * @param {string} variant
 * @returns {string}
 */
export function getFrameworkKey(name, variant) {
  return `${name}:${variant}`;
}

/**
 * Retrieve capability descriptor for a framework/variant pair.
 * @param {{ name: string, variant: string }} framework
 * @returns {object | null}
 */
export function getFrameworkDescriptor(framework) {
  if (!framework || !framework.name || !framework.variant) return null;
  const key = getFrameworkKey(framework.name, framework.variant);
  return FRAMEWORK_CAPABILITIES[key] || null;
}

/**
 * Check if a framework has a declared capability.
 * @param {{ name: string, variant: string }} framework
 * @param {string} capability
 * @returns {boolean}
 */
export function hasCapability(framework, capability) {
  const desc = getFrameworkDescriptor(framework);
  if (!desc) return false;
  return desc.capabilities.includes(capability);
}

/**
 * Check whether an option value is compatible with the framework's capabilities.
 * @param {{ name: string, variant: string }} framework
 * @param {string} optionKey
 * @param {*} optionValue
 * @returns {boolean}
 */
export function isOptionCompatible(framework, optionKey, optionValue) {
  const desc = getFrameworkDescriptor(framework);
  if (!desc) return false;

  switch (optionKey) {
    case "architecture": {
      let val = optionValue;
      if (val === "component" || val === "component-based") val = "type-based";
      if (val === "feature") val = "feature-based";
      return desc.allowedArchitectures.includes(val);
    }
    case "styling":
    case "cssFramework":
      return desc.allowedStyling.includes(optionValue);
    case "uiKit":
    case "ui":
      return desc.allowedUiKits.includes(optionValue);
    case "language":
      return desc.allowedLanguages.includes(optionValue);
    case "linter":
      return desc.allowedLinters.includes(optionValue);
    case "formatter":
      return desc.allowedFormatters.includes(optionValue);
    case "bundler":
      return desc.allowedBundlers.includes(optionValue);
    case "adapter":
      if (optionValue === "none") {
        return desc.allowedAdapters.length > 0;
      }
      return desc.allowedAdapters.includes(optionValue);
    case "router":
      // If framework has filesystem routing, external router options (true) are incompatible
      if (hasCapability(framework, CAPABILITIES.FILESYSTEM_ROUTING)) {
        return optionValue === false || optionValue === "none";
      }
      return true;
    case "reactCompiler":
      if (optionValue === true) {
        return hasCapability(framework, CAPABILITIES.REACT_COMPILER);
      }
      return true;
    default:
      return true;
  }
}

/**
 * Return all compatible option domains for a framework.
 * @param {{ name: string, variant: string }} framework
 * @returns {object | null}
 */
export function getCompatibleOptions(framework) {
  const desc = getFrameworkDescriptor(framework);
  if (!desc) return null;

  return {
    capabilities: [...desc.capabilities],
    architectures: [...desc.allowedArchitectures],
    styling: [...desc.allowedStyling],
    uiKits: [...desc.allowedUiKits],
    languages: [...desc.allowedLanguages],
    linters: [...desc.allowedLinters],
    formatters: [...desc.allowedFormatters],
    bundlers: [...desc.allowedBundlers],
    adapters: [...desc.allowedAdapters],
    supportsRouterPrompt: desc.supportsRouterPrompt,
  };
}

/**
 * Validate a set of options against framework capabilities.
 * Returns { valid: true } or { valid: false, errors: string[] }
 * @param {{ name: string, variant: string }} framework
 * @param {object} options
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCompatibility(framework, options = {}) {
  const desc = getFrameworkDescriptor(framework);
  if (!desc) {
    return {
      valid: false,
      errors: [`Unsupported framework "${framework?.name}:${framework?.variant}"`],
    };
  }

  const errors = [];

  for (const [key, val] of Object.entries(options)) {
    if (val === undefined || val === null) continue;
    if (!isOptionCompatible(framework, key, val)) {
      errors.push(
        `Option "${key}" with value "${val}" is incompatible with framework "${framework.name}:${framework.variant}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize framework input into a standard { name, variant } descriptor.
 * @param {string | { name?: string, variant?: string } | null | undefined} framework
 * @returns {{ name: string, variant: string }}
 */
export function normalizeFramework(framework) {
  if (!framework) {
    return { name: "react", variant: "vite" };
  }

  if (typeof framework === "string") {
    const trimmed = framework.trim();
    if (!trimmed) {
      return { name: "react", variant: "vite" };
    }
    if (trimmed.includes(":")) {
      const [name, ...rest] = trimmed.split(":");
      return { name, variant: rest.join(":") };
    }
    if (trimmed === "next") {
      return { name: "next", variant: "app-router" };
    }
    if (trimmed === "react") {
      return { name: "react", variant: "vite" };
    }
    return { name: trimmed, variant: "vite" };
  }

  if (typeof framework === "object") {
    const name = framework.name || "react";
    const variant =
      framework.variant || (framework.name === "next" ? "app-router" : "vite");
    return { name, variant };
  }

  return { name: "react", variant: "vite" };
}

/**
 * Determine whether a prompt should be presented to the user based on framework capabilities.
 * @param {string | object} framework
 * @param {string} promptName
 * @returns {boolean}
 */
export function isPromptVisible(framework, promptName) {
  const fw = normalizeFramework(framework);
  const desc = getFrameworkDescriptor(fw);

  switch (promptName) {
    case "router":
      return (
        hasCapability(fw, CAPABILITIES.CLIENT_ROUTING) &&
        Boolean(desc?.supportsRouterPrompt)
      );
    case "bundler":
      return hasCapability(fw, CAPABILITIES.BUNDLER_SELECTION);
    case "adapter":
      return hasCapability(fw, CAPABILITIES.ADAPTERS);
    case "reactCompiler":
      return hasCapability(fw, CAPABILITIES.REACT_COMPILER);
    default:
      return true;
  }
}

/**
 * Filter an array of choice objects or values based on framework compatibility.
 * @param {string | object} framework
 * @param {string} optionKey
 * @param {Array<object | string>} choices
 * @returns {Array<object | string>}
 */
export function filterCompatibleChoices(framework, optionKey, choices = []) {
  const fw = normalizeFramework(framework);
  if (!Array.isArray(choices)) return [];
  return choices.filter((choice) =>
    isOptionCompatible(fw, optionKey, choice?.value ?? choice)
  );
}

/**
 * Get canonical default prompt responses for a given framework.
 * @param {string | object} framework
 * @param {{ projectName?: string }} [options]
 * @returns {object}
 */
export function getDefaultResponses(framework, { projectName = "my-app" } = {}) {
  const fw = normalizeFramework(framework);

  if (fw.name === "next") {
    return {
      projectName,
      frameworkName: fw.name,
      frameworkVariant: fw.variant,
      architecture: "feature-based",
      language: "ts",
      cssFramework: "tailwind",
      testing: "vitest",
      router: false,
      bundler: "turbopack",
      adapter: "none",
      uiKit: "none",
      stateManagement: "none",
      iconLibrary: "none",
      apiClient: "none",
      linter: "eslint",
      formatter: "prettier",
      docsLanguage: "en",
      gitInit: true,
      readme: true,
    };
  }

  return {
    projectName,
    frameworkName: "react",
    frameworkVariant: "vite",
    architecture: "feature-based",
    language: "ts",
    cssFramework: "tailwind",
    testing: "vitest",
    router: true,
    uiKit: "none",
    stateManagement: "none",
    iconLibrary: "none",
    apiClient: "none",
    linter: "eslint",
    formatter: "prettier",
    docsLanguage: "en",
    gitInit: true,
    readme: true,
  };
}

/**
 * Sanitize prompt responses for a framework by adjusting or resetting incompatible options.
 * @param {string | object} framework
 * @param {object} [responses]
 * @returns {object}
 */
export function sanitizeResponsesForFramework(framework, responses = {}) {
  const fw = normalizeFramework(framework);
  const sanitized = { ...(responses || {}) };
  const defaults = getDefaultResponses(fw, {
    projectName: sanitized.projectName || "my-app",
  });

  if (!isPromptVisible(fw, "router")) {
    sanitized.router = false;
  }
  if (!isPromptVisible(fw, "bundler")) {
    delete sanitized.bundler;
  }
  if (!isPromptVisible(fw, "adapter")) {
    delete sanitized.adapter;
  }
  if (!isPromptVisible(fw, "reactCompiler")) {
    if (sanitized.reactCompiler !== undefined) {
      sanitized.reactCompiler = false;
    }
  }

  for (const [key, val] of Object.entries(sanitized)) {
    if (val === undefined || val === null) continue;
    if (!isOptionCompatible(fw, key, val)) {
      if (key in defaults) {
        sanitized[key] = defaults[key];
      } else if (key === "styling" && "cssFramework" in defaults) {
        sanitized[key] = defaults.cssFramework;
      } else {
        sanitized[key] = defaults[key];
      }
    }
  }

  return sanitized;
}

