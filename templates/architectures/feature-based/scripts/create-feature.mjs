#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

// 1. Get feature name from CLI args
const featureName = process.argv[2];

if (!featureName) {
  console.error("\x1b[31mError:\x1b[0m Please specify the feature name.");
  console.log("\x1b[36mExample:\x1b[0m npm run create:feature products");
  process.exit(1);
}

const formattedName = featureName.trim().toLowerCase();
const featureDir = path.join(process.cwd(), "src", "features", formattedName);

// 2. Feature-First subdirectories
const subdirectories = [
  "components",
  "hooks",
  "layouts",
  "pages",
  "services",
  "store",
  "types",
];

// 3. Initial files with starter content
const initialFiles = {
  "services/index.ts": `// Endpoints and async calls for the ${formattedName} module\n`,
  "store/index.ts": `// State for the ${formattedName} module\n`,
  "pages/index.ts": `// Page components for the ${formattedName} module\n`,
  "types/index.ts": `// Types exclusive to the ${formattedName} module\n`,
};

// 4. Create the feature
try {
  if (fs.existsSync(featureDir)) {
    console.error(
      `\x1b[31mError:\x1b[0m Feature "${formattedName}" already exists in src/features/.`
    );
    process.exit(1);
  }

  console.log(`\x1b[34mCreating feature:\x1b[0m ${formattedName}...`);

  // Create main directory and subdirectories
  fs.mkdirSync(featureDir, { recursive: true });
  subdirectories.forEach((subDir) => {
    fs.mkdirSync(path.join(featureDir, subDir), { recursive: true });
  });

  // Create base files
  for (const [filePath, content] of Object.entries(initialFiles)) {
    fs.writeFileSync(path.join(featureDir, filePath), content, "utf8");
  }

  console.log(
    `\x1b[32mSuccess!\x1b[0m Feature "${formattedName}" created at src/features/${formattedName}`
  );
} catch (error) {
  console.error("\x1b[31mUnexpected error:\x1b[0m", error);
  process.exit(1);
}
