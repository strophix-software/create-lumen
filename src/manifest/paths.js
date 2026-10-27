/**
 * Path mapping for lumen.config.json — #15
 * Resolves the 6 generator target directories from framework + architecture.
 * Paths are relative to project root and use posix separators.
 */

export const PATH_KEYS = ["features", "components", "services", "hooks", "pages", "ui"];

/**
 * @param {{ architecture: string, framework?: { name?: string, variant?: string } }} opts
 * @returns {{ features: string, components: string, services: string, hooks: string, pages: string, ui: string }}
 */
export function resolvePaths({ architecture, framework = {} } = {}) {
  const arch = architecture || "feature-based";
  const fwName = framework.name || "react";
  const variant = framework.variant || (fwName === "next" ? "app-router" : "vite");

  // Helper to pick Next.js pages root based on variant
  const nextPagesForVariant = (v) => (v === "pages-router" ? "src/pages" : "src/app");
  const isNext = fwName === "next";

  // -- feature-based (React + Vite canonical, also Next feature-based)
  if (arch === "feature-based") {
    if (isNext) {
      const nextRoot = nextPagesForVariant(variant);
      // Next keeps features in src/features, shared code in src/shared, routing in app/ or pages/
      // Use posix paths regardless of OS
      return {
        features: "src/features",
        components: "src/shared/components",
        services: "src/shared/services",
        hooks: "src/shared/hooks",
        pages: nextRoot, // app/ or pages/ at project root for Next
        ui: "src/shared/components/ui",
      };
    }
    return {
      features: "src/features",
      components: "src/shared/components",
      services: "src/shared/services",
      hooks: "src/shared/hooks",
      pages: "src/app/router",
      ui: "src/shared/components/ui",
    };
  }

  // -- type-based (React + Vite only; component-based supported as legacy alias)
  if (arch === "type-based" || arch === "component-based") {
    if (isNext) {
      // Not a valid combo per schema, but provide a deterministic fallback
      // to keep resolver total (hybrid should be used for Next)
      const nextRoot = nextPagesForVariant(variant);
      return {
        features: "src/components",
        components: "src/components",
        services: "src/services",
        hooks: "src/hooks",
        pages: nextRoot,
        ui: "src/components/ui",
      };
    }
    return {
      features: "src/features",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/ui",
    };
  }

  // -- none (minimal flat src/ — no imposed convention)
  if (arch === "none") {
    if (isNext) {
      const nextRoot = nextPagesForVariant(variant);
      return {
        features: "src",
        components: "src/components",
        services: "src/services",
        hooks: "src/hooks",
        pages: nextRoot,
        ui: "src/components/ui",
      };
    }
    return {
      features: "src",
      components: "src/components",
      services: "src/services",
      hooks: "src/hooks",
      pages: "src/pages",
      ui: "src/components/ui",
    };
  }

  // Fallback: treat unknown as feature-based
  return {
    features: "src/features",
    components: "src/shared/components",
    services: "src/shared/services",
    hooks: "src/shared/hooks",
    pages: isNext ? nextPagesForVariant(variant) : "src/app/router",
    ui: "src/shared/components/ui",
  };
}
