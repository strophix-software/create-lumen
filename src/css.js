import { promises as fsp } from "fs";
import path from "path";
import { deleteIfExists } from "@/utils/fs.js";
import {
  normalizeFramework,
  hasCapability,
  CAPABILITIES,
} from "@/engine/capabilities.js";

export async function setupCssFramework({
  projectPath,
  templatesDir,
  language,
  cssFramework,
  architecture,
  ext,
  pkg: _pkg,
  framework = "vite",
}) {
  const fw = normalizeFramework(framework);
  const isFilesystemRouted = hasCapability(fw, CAPABILITIES.FILESYSTEM_ROUTING);
  const cssDir = path.join(templatesDir, "css");
  // Feature-based main.* imports ./shared/styles/globals.css (or main.css when
  // framework is "none"); type-based imports ./styles/globals.css (or
  // main.css). The chosen framework's styles land in the file the architecture
  // actually imports.
  let stylesDir;
  if (fw.name === "next") {
    stylesDir =
      fw.variant === "pages-router"
        ? path.join(projectPath, "src", "styles")
        : path.join(projectPath, "src", "app");
  } else {
    stylesDir =
      architecture === "feature-based"
        ? path.join(projectPath, "src", "shared", "styles")
        : path.join(projectPath, "src", "styles");
  }

  // Vanilla CSS gets a stylesheet named main.css; tailwind keeps
  // globals.css (its idiomatic name — it injects framework directives).
  const mainFileName = cssFramework === "none" ? "main.css" : "globals.css";

  // Ensure the styles dir exists
  await fsp.mkdir(stylesDir, { recursive: true });

  async function writeCss(content, fileName) {
    await fsp.writeFile(path.join(stylesDir, fileName), content, "utf8");
  }

  if (cssFramework === "tailwind") {
    if (isFilesystemRouted || fw.name === "next") {
      const postcssConfigFile = "postcss.config.mjs";
      const postcssConfigTarget = path.join(projectPath, postcssConfigFile);
      const postcssConfigContent = await fsp.readFile(
        path.join(cssDir, "tailwind", postcssConfigFile),
        "utf8"
      );
      await fsp.writeFile(postcssConfigTarget, postcssConfigContent, "utf8");
    } else {
      const viteConfigFile = `vite.config.${language === "ts" ? "ts" : "js"}`;
      const viteConfigTarget = path.join(projectPath, viteConfigFile);
      const viteConfigContent = await fsp.readFile(
        path.join(cssDir, "tailwind", viteConfigFile),
        "utf8"
      );
      await fsp.writeFile(viteConfigTarget, viteConfigContent, "utf8");
    }

    const globalsContent = await fsp.readFile(
      path.join(cssDir, "tailwind", "src", "globals.css"),
      "utf8"
    );
    const themesContent = await fsp.readFile(
      path.join(cssDir, "tailwind", "src", "themes.css"),
      "utf8"
    );
    await writeCss(globalsContent, "globals.css");
    await writeCss(themesContent, "themes.css");
  } else {
    const mainContent = await fsp.readFile(
      path.join(cssDir, "none", "src", "main.css"),
      "utf8"
    );
    const themesContent = await fsp.readFile(
      path.join(cssDir, "none", "src", "themes.css"),
      "utf8"
    );
    await writeCss(mainContent, "main.css");
    await writeCss(themesContent, "themes.css");
  }

  // Ensure main.{ext} imports the correct stylesheet name for this framework.
  await syncMainCssImport(projectPath, ext, architecture, mainFileName);

  // Ensure the styles dir exists (for the .gitkeep placeholder when no real
  // file lives there yet — pruneRedundantGitkeeps removes it after overlays).
  await fsp.mkdir(stylesDir, { recursive: true });

  // Clean up Vite's default CSS files; src/index.css is the framework-agnostic
  // leftover Vite scaffolds and is never imported in our generated projects.
  await deleteIfExists(path.join(projectPath, "src", "App.css"));
  await deleteIfExists(path.join(projectPath, "src", "index.css"));
}

// Rewrite the CSS import in main.{ext} so it matches the file the framework
// actually wrote (main.css for "none", globals.css for tailwind).
async function syncMainCssImport(projectPath, ext, architecture, mainFileName) {
  const mainPath = path.join(projectPath, "src", `main.${ext}`);
  try {
    let content = await fsp.readFile(mainPath, "utf8");
    const expected =
      architecture === "feature-based"
        ? `./shared/styles/${mainFileName}`
        : `./styles/${mainFileName}`;
    const wrong =
      architecture === "feature-based"
        ? /import ['"]\.\/shared\/styles\/(globals|main)\.css['"]/
        : /import ['"]\.\/styles\/(globals|main)\.css['"]/;
    content = content.replace(wrong, `import '${expected}'`);
    await fsp.writeFile(mainPath, content, "utf8");
  } catch {}
}
