import path from "node:path";
import {
  FRAMEWORK_CAPABILITIES,
  getFrameworkKey,
} from "../capabilities.js";

/**
 * Abstract BaseProvider seam (ADR 0001 / create-lumen#25).
 * Encapsulates framework capabilities, base template file plans,
 * default package sets, and post-write lifecycle hooks.
 */
export class BaseProvider {
  /**
   * @param {object} config
   * @param {string} config.name - framework name (e.g. "react", "next")
   * @param {string} config.variant - framework variant (e.g. "vite", "app-router", "pages-router")
   * @param {string[]} [config.capabilities]
   */
  constructor({ name, variant, capabilities = [] }) {
    if (new.target === BaseProvider) {
      throw new TypeError("Cannot instantiate abstract BaseProvider directly");
    }
    this.name = name;
    this.variant = variant;
    this.capabilities = new Set(capabilities);
  }

  /**
   * Return array of declared capabilities.
   * @returns {string[]}
   */
  getCapabilities() {
    return Array.from(this.capabilities);
  }

  /**
   * Check if provider has a capability.
   * @param {string} capability
   * @returns {boolean}
   */
  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  /**
   * Return relative file path pattern to the base template directory.
   * Pattern: templates/bases/<provider>/<variant>/<lang>/
   * @param {{ lang?: string }} [opts]
   * @returns {string}
   */
  getFilePlan({ lang = "ts" } = {}) {
    return path.posix.join("templates", "bases", this.name, this.variant, lang);
  }

  /**
   * Return base package dependencies and devDependencies.
   * @param {object} [_options]
   * @returns {{ dependencies: Record<string, string>, devDependencies: Record<string, string> }}
   */
  getPackageSet(_options = {}) {
    return {
      dependencies: {},
      devDependencies: {},
    };
  }

  /**
   * Return post-write hooks to execute after files are written.
   * @param {object} [_options]
   * @returns {Array<{ name: string, run: (context: object) => Promise<void> | void }>}
   */
  getPostWriteHooks(_options = {}) {
    return [];
  }
}

/**
 * React + Vite concrete provider.
 */
export class ViteReactProvider extends BaseProvider {
  constructor() {
    const desc = FRAMEWORK_CAPABILITIES["react:vite"];
    super({
      name: "react",
      variant: "vite",
      capabilities: desc.capabilities,
    });
  }

  getPackageSet({ options = {} } = {}) {
    const isTs = options.language === "ts";
    const deps = {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    };
    const devDeps = {
      vite: "^6.0.0",
      "@vitejs/plugin-react": "^4.3.0",
    };
    if (isTs) {
      devDeps.typescript = "^5.7.0";
      devDeps["@types/react"] = "^19.0.0";
      devDeps["@types/react-dom"] = "^19.0.0";
    }
    return {
      dependencies: deps,
      devDependencies: devDeps,
    };
  }
}

/**
 * Next.js App Router concrete provider.
 */
export class NextAppRouterProvider extends BaseProvider {
  constructor() {
    const desc = FRAMEWORK_CAPABILITIES["next:app-router"];
    super({
      name: "next",
      variant: "app-router",
      capabilities: desc.capabilities,
    });
  }

  getPackageSet({ options = {} } = {}) {
    const isTs = options.language === "ts";
    const deps = {
      next: "^16.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    };
    const devDeps = {};
    if (isTs) {
      devDeps.typescript = "^5.7.0";
      devDeps["@types/react"] = "^19.0.0";
      devDeps["@types/react-dom"] = "^19.0.0";
      devDeps["@types/node"] = "^22.0.0";
    }
    return {
      dependencies: deps,
      devDependencies: devDeps,
    };
  }
}

/**
 * Next.js Pages Router concrete provider.
 */
export class NextPagesRouterProvider extends BaseProvider {
  constructor() {
    const desc = FRAMEWORK_CAPABILITIES["next:pages-router"];
    super({
      name: "next",
      variant: "pages-router",
      capabilities: desc.capabilities,
    });
  }

  getPackageSet({ options = {} } = {}) {
    const isTs = options.language === "ts";
    const deps = {
      next: "^16.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    };
    const devDeps = {};
    if (isTs) {
      devDeps.typescript = "^5.7.0";
      devDeps["@types/react"] = "^19.0.0";
      devDeps["@types/react-dom"] = "^19.0.0";
      devDeps["@types/node"] = "^22.0.0";
    }
    return {
      dependencies: deps,
      devDependencies: devDeps,
    };
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------
const providerRegistry = new Map();

/**
 * Register a BaseProvider instance in the registry.
 * @param {BaseProvider} provider
 */
export function registerProvider(provider) {
  if (!(provider instanceof BaseProvider)) {
    throw new TypeError("provider must be an instance of BaseProvider");
  }
  const key = getFrameworkKey(provider.name, provider.variant);
  providerRegistry.set(key, provider);
}

/**
 * Retrieve registered provider by framework name and variant.
 * @param {string} name
 * @param {string} variant
 * @returns {BaseProvider | null}
 */
export function getProvider(name, variant) {
  const key = getFrameworkKey(name, variant);
  return providerRegistry.get(key) || null;
}

/**
 * List all registered providers.
 * @returns {BaseProvider[]}
 */
export function listProviders() {
  return Array.from(providerRegistry.values());
}

// Auto-register default providers
registerProvider(new ViteReactProvider());
registerProvider(new NextAppRouterProvider());
registerProvider(new NextPagesRouterProvider());
