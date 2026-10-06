import { noServerImportsInClient } from "./rules/no-server-imports-in-client.mjs";

let baseConfig = [];
try {
  const next = await import("eslint-config-next");
  const imported = next.default || next;
  baseConfig = Array.isArray(imported) ? imported : [imported];
} catch {
  try {
    const { FlatCompat } = await import("@eslint/eslintrc");
    const { fileURLToPath } = await import("url");
    const { dirname } = await import("path");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const compat = new FlatCompat({ baseDirectory: __dirname });
    baseConfig = compat.extends("next/core-web-vitals");
  } catch {}
}

const eslintConfig = [
  ...baseConfig,
  {
    plugins: {
      rsc: {
        rules: {
          "no-server-imports-in-client": noServerImportsInClient,
        },
      },
    },
    rules: {
      "rsc/no-server-imports-in-client": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["server-only", "**/server-only/**"],
              message: "Do not import server-only packages in client modules.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
