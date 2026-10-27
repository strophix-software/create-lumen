import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileRecursive } from "@/utils/fs.js";
import { normalizeFramework } from "@/engine/capabilities.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TEMPLATES_DIR = path.join(__dirname, "../templates");

export function isNextFramework(responses = {}) {
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );
  return fw.name === "next";
}

function buildBuiltWith(responses, isNext = false) {
  const fw = normalizeFramework(
    responses.framework || {
      name: responses.frameworkName,
      variant: responses.frameworkVariant,
    }
  );

  const items = [];
  if (isNext) {
    if (fw.variant === "pages-router") {
      items.push("[Next.js](https://nextjs.org/) (Pages Router)");
    } else {
      items.push("[Next.js 16](https://nextjs.org/) (App Router + Turbopack)");
    }
  } else {
    items.push("[React](https://reactjs.org/) + [Vite](https://vitejs.dev/)");
  }

  if (responses.language === "ts") {
    items.push("[TypeScript](https://www.typescriptlang.org/)");
  } else {
    items.push("[JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)");
  }

  if (responses.cssFramework === "tailwind") {
    items.push("[Tailwind CSS](https://tailwindcss.com/)");
  }

  if (responses.uiKit === "shadcn") {
    items.push("[shadcn/ui](https://ui.shadcn.com/)");
  }

  if (responses.database === "prisma") {
    const dbProvider =
      responses.databaseProvider === "supabase"
        ? " (Supabase PostgreSQL)"
        : " (PostgreSQL)";
    items.push(`[Prisma ORM](https://www.prisma.io/)${dbProvider}`);
  }

  if (responses.router && !isNext) {
    items.push("[React Router](https://reactrouter.com/)");
  }

  if (responses.stateManagement === "redux") {
    items.push("[Redux Toolkit](https://redux-toolkit.js.org/)");
  } else if (responses.stateManagement === "zustand") {
    items.push("[Zustand](https://zustand-demo.pmnd.rs/)");
  }

  if (responses.iconLibrary === "lucide") {
    items.push("[Lucide Icons](https://lucide.dev/)");
  } else if (responses.iconLibrary === "huge") {
    items.push("[Huge Icons](https://hugeicons.com/)");
  }

  if (responses.apiClient === "axios") {
    items.push("[Axios](https://axios-http.com/)");
  } else if (responses.apiClient === "fetch") {
    items.push("Fetch API");
  }

  if (responses.testing === "vitest") {
    items.push("[Vitest](https://vitest.dev/)");
  } else if (responses.testing === "jest") {
    items.push("[Jest](https://jestjs.io/)");
  }

  if (responses.linter === "eslint") {
    items.push("[ESLint](https://eslint.org/)");
  } else if (responses.linter === "oxlint") {
    items.push("[Oxlint](https://oxc.rs/)");
  } else if (responses.linter === "biome") {
    items.push("[Biome](https://biomejs.dev/)");
  }

  if (responses.formatter === "prettier") {
    items.push("[Prettier](https://prettier.io/)");
  } else if (responses.formatter === "oxfmt") {
    items.push("[Oxfmt](https://oxc.rs/)");
  } else if (responses.formatter === "biome" && responses.linter !== "biome") {
    items.push("[Biome](https://biomejs.dev/)");
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function buildScripts(responses, isNext = false) {
  const rows = [];
  if (isNext) {
    rows.push(
      "| `npm run dev` | Start development server (Turbopack) |",
      "| `npm run build` | Build for production |",
      "| `npm run start` | Start production server |"
    );
  } else {
    rows.push(
      "| `npm run dev` | Start development server |",
      "| `npm run build` | Build for production |",
      "| `npm run preview` | Preview production build |"
    );
  }

  if (responses.database === "prisma") {
    rows.push(
      "| `npm run db:generate` | Generate Prisma Client |",
      "| `npm run db:push` | Push schema changes directly to database |",
      "| `npm run db:seed` | Seed database |",
      "| `npm run db:studio` | Open Prisma Studio GUI |"
    );
  }

  if (responses.testing && responses.testing !== "none") {
    rows.push("| `npm run test` | Run tests |");
  }

  if (responses.linter === "eslint") {
    rows.push("| `npm run lint` | Run ESLint |");
    rows.push("| `npm run lint:fix` | Run ESLint with auto-fix |");
  } else if (responses.linter === "oxlint") {
    rows.push("| `npm run lint` | Run Oxlint |");
  } else if (responses.linter === "biome") {
    rows.push("| `npm run lint` | Run Biome linter |");
  }

  if (
    responses.formatter === "prettier" ||
    responses.formatter === "oxfmt" ||
    responses.formatter === "biome"
  ) {
    rows.push("| `npm run format` | Format code |");
    rows.push("| `npm run format:check` | Verify code is formatted |");
  }

  if (responses.language === "ts") {
    rows.push("| `npm run typecheck` | Type-check the project (tsc -b) |");
  }

  return rows.join("\n");
}

function nestedTree(rows, indent = "    ") {
  return rows
    .map((label, i) => {
      const isLast = i === rows.length - 1;
      return `${indent}${isLast ? "└── " : "├── "}${label}`;
    })
    .join("\n");
}

function buildProjectStructure(responses, isNext = false) {
  const ext = responses.language === "ts" ? "tsx" : "jsx";
  const codeExt = responses.language === "ts" ? "ts" : "js";

  if (isNext) {
    if (responses.architecture === "feature-based") {
      const appChildren = [];
      if (responses.routeGroups) {
        appChildren.push(
          "(public)/    # Public route group (landing, marketing)",
          "(auth)/      # Authentication route group (login, register)",
          "(private)/   # Protected route group (dashboard, settings)",
          "(admin)/     # Role-restricted route group",
          `layout.${ext}    # Root layout (Server Component)`,
          "globals.css   # Tailwind CSS & global styling directives"
        );
      } else {
        appChildren.push(
          `layout.${ext}    # Root layout (Server Component)`,
          `page.${ext}      # Home page (Server Component)`,
          "globals.css   # Tailwind CSS & global styling directives"
        );
      }

      const shared = [
        "components/ # Shared UI components & primitives",
        "hooks/      # Shared custom hooks",
        "layouts/    # High-level layout wrappers",
        "stores/     # Global state stores",
        "types/      # Global TypeScript definitions",
        "utils/      # Pure utility functions",
      ];

      const rows = [
        "app/          # Next.js App Router (Server & Client Components)",
        nestedTree(appChildren),
      ];

      if (responses.routeGroups) {
        rows.push(`proxy.${codeExt}      # Next.js 16 Edge Route Guard (Auth Proxy)`);
      }

      rows.push(
        "features/     # Feature modules (pages, hooks, api, types)",
        "shared/       # Reusable, domain-agnostic resources",
        nestedTree(shared)
      );

      return `src/\n${nestedTree(rows, "")}`;
    }

    // Architecture: none
    const appRows = [
      `layout.${ext}    # Root layout (Server Component)`,
      `page.${ext}      # Application entry page`,
      "globals.css   # Global styling directives",
    ];
    return `src/\n└── app/          # Next.js App Router\n${nestedTree(appRows, "    ")}`;
  }

  // Vite framework structures
  if (responses.architecture === "feature-based") {
    const shared = [];
    if (responses.apiClient === "fetch") {
      shared.push("api/      # HTTP client (fetch) — not an external dependency");
    } else if (responses.apiClient === "axios") {
      shared.push("lib/      # Third-party library init (axios client)");
    }
    shared.push(
      "components/ # Shared UI components",
      "hooks/    # Shared custom hooks",
      "layouts/  # High-level layout wrappers",
      "stores/   # Global state stores",
      `styles/   # ${
        responses.cssFramework === "none"
          ? "main.css (reset) + themes.css (CSS variables)"
          : "globals.css (framework directives) + themes.css"
      }`,
      "types/    # Global type definitions",
      "utils/    # Pure utility functions"
    );
    const appChildren = [
      `App.${ext}`,
      "contexts/   # React context objects (createContext)",
      "providers/  # Provider components (ThemeProvider, ...)",
      "hooks/      # Hooks that read the contexts (useTheme, ...)",
    ];
    return `src/
├── app/          # App shell and global providers
${nestedTree(appChildren)}
├── features/     # Feature modules (pages, hooks, api, types)
│   └── home/     # Example feature (components, services, types, store)
└── shared/       # Reusable, business-agnostic resources
${nestedTree(shared)}`;
  }

  if (responses.architecture === "none") {
    return `src/
├── App.${ext}          # Root application component
├── main.${ext}         # Application entry point
└── styles/       # Stylesheets`;
  }

  const rows = ["components/   # Reusable UI components (common, form)"];
  if (responses.apiClient !== "none") {
    rows.push("config/       # API configuration (axios/fetch)");
  }
  rows.push(
    "hooks/        # Shared custom hooks",
    "layouts/      # Page layout wrappers",
    "pages/        # Page-level components",
    "providers/    # Provider components (createContext in appcontext.{ts,js}, Provider in AppProvider.{tsx,jsx})"
  );
  if (responses.router) {
    rows.push("router/       # Centralized data router (guards/, index)");
  }
  rows.push(
    "services/     # API service layer",
    "store/        # State store",
    `styles/       # ${
      responses.cssFramework === "none"
        ? "main.css (reset) + themes.css (CSS variables)"
        : "globals.css (framework directives) + themes.css"
    }`,
    "types/        # TypeScript type definitions",
    "utils/        # Utility functions"
  );
  return `src/
${nestedTree(rows, "")}`;
}

function buildRouteGroupsProxySection(responses) {
  if (!responses.routeGroups) return "";

  const codeExt = responses.language === "ts" ? "ts" : "js";
  return `
## Route Groups & Edge Auth Proxy

This project includes an edge route guard conforming to the **Next.js 16 Proxy specification** (\`src/proxy.${codeExt}\`).

- **\`(public)\`**: Marketing and landing pages accessible to all visitors.
- **\`(auth)\`**: Sign in and registration pages. Authenticated users are automatically redirected to \`/dashboard\`.
- **\`(private)\`**: Protected application routes (\`/dashboard\`, \`/settings\`) requiring session authentication.
- **\`(admin)\`**: Protected administration routes (\`/admin\`) requiring administrative role privileges.
- **Edge Route Guard (\`src/proxy.${codeExt}\`)**: Evaluates incoming request cookies (\`auth-token\`, \`user-role\`) before routes are rendered, routing unauthorized requests to \`/login?from=...\` and unauthorized admin access back to \`/dashboard\`.
`;
}

function buildDescription(projectName, responses, isNext = false) {
  const tools = [];
  if (responses.linter === "eslint") tools.push("ESLint");
  else if (responses.linter === "oxlint") tools.push("Oxlint");
  else if (responses.linter === "biome") tools.push("Biome");

  if (responses.formatter === "prettier") tools.push("Prettier");
  else if (responses.formatter === "oxfmt") tools.push("Oxfmt");
  else if (responses.formatter === "biome" && responses.linter !== "biome") tools.push("Biome");

  let suffix = "";
  if (tools.length > 0) {
    suffix = `\n\nThis project is set up with ${tools.join(" + ")} for code quality.`;
  }

  if (isNext) {
    return `# ${projectName}\n\nA Next.js 16 (App Router + Turbopack) application built with ${responses.architecture}.${suffix}`;
  }
  return `# ${projectName}\n\nA React + Vite application built with ${responses.architecture}.${suffix}`;
}

function buildLicense() {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

export function buildReadme(projectName, responses, templatesDir = DEFAULT_TEMPLATES_DIR) {
  const isNext = isNextFramework(responses);
  const tplFileName = isNext ? "README.next.md.tpl" : "README.vite.md.tpl";
  const tplPath = path.join(templatesDir, "readme", tplFileName);

  let template;
  try {
    template = fs.readFileSync(tplPath, "utf8");
  } catch {
    template = isNext ? FALLBACK_NEXT_TPL : FALLBACK_VITE_TPL;
  }

  const description = buildDescription(projectName, responses, isNext);
  const builtWith = buildBuiltWith(responses, isNext);
  const scripts = buildScripts(responses, isNext);
  const structure = buildProjectStructure(responses, isNext);
  const routeGroupsSection = isNext ? buildRouteGroupsProxySection(responses) : "";

  return template
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{DESCRIPTION\}\}/g, description)
    .replace(/\{\{BUILT_WITH\}\}/g, builtWith)
    .replace(/\{\{SCRIPTS\}\}/g, scripts)
    .replace(/\{\{PROJECT_STRUCTURE\}\}/g, structure)
    .replace(/\{\{ROUTE_GROUPS_PROXY_SECTION\}\}/g, routeGroupsSection);
}

const FALLBACK_VITE_TPL = `# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Built With

{{BUILT_WITH}}

## Getting Started

\`\`\`sh
npm install
npm run dev
\`\`\`

## Scripts

| Script | Description |
|--------|-------------|
{{SCRIPTS}}

## Project Structure

<!-- TODO: Update this to match your actual structure -->

\`\`\`
{{PROJECT_STRUCTURE}}
\`\`\`

## Authors

- **Your Name** - [@your_twitter](https://twitter.com/your_twitter) - your@email.com

See also the list of [contributors](https://github.com/your_username/{{PROJECT_NAME}}/graphs/contributors) who participated in this project.

## License

Distributed under the MIT License. See \`LICENSE\` for more information.
`;

const FALLBACK_NEXT_TPL = `# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Built With

{{BUILT_WITH}}

## Getting Started

First, install dependencies and run the development server:

\`\`\`sh
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

| Script | Description |
|--------|-------------|
{{SCRIPTS}}

## Project Structure

This project is built on **Next.js 16 (App Router + Turbopack)** with React Server Components (RSC) by default.

\`\`\`
{{PROJECT_STRUCTURE}}
\`\`\`
{{ROUTE_GROUPS_PROXY_SECTION}}
## Authors

- **Your Name** - [@your_twitter](https://twitter.com/your_twitter) - your@email.com

See also the list of [contributors](https://github.com/your_username/{{PROJECT_NAME}}/graphs/contributors) who participated in this project.

## License

Distributed under the MIT License. See \`LICENSE\` for more information.
`;

export async function generateReadme(projectPath, projectName, responses, templatesDir = DEFAULT_TEMPLATES_DIR) {
  const readmeContent = buildReadme(projectName, responses, templatesDir);
  const licenseContent = buildLicense();

  await writeFileRecursive(path.join(projectPath, "README.md"), readmeContent);
  await writeFileRecursive(path.join(projectPath, "LICENSE"), licenseContent);
}
