/**
 * ESLint Rule: rsc/no-server-imports-in-client
 *
 * Enforces server/client boundaries in React Server Components (RSC).
 * When a file is marked with the "use client" directive, it is prohibited
 * from importing server-only packages (e.g. 'server-only', Node.js builtins,
 * or modules from server-designated paths).
 */

export const noServerImportsInClient = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow server-only imports in client components marked with 'use client'",
      category: "Possible Errors",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          serverModules: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noServerImport:
        "Server-only module '{{name}}' cannot be imported into a Client Component ('use client'). Keep server logic on the server side of the RSC boundary.",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const restrictedSet = new Set(
      options.serverModules || [
        "server-only",
        "node:fs",
        "node:fs/promises",
        "fs",
        "fs/promises",
        "node:child_process",
        "child_process",
        "node:net",
        "net",
        "node:tls",
        "tls",
      ]
    );

    let isClientComponent = false;

    return {
      Program(node) {
        for (const stmt of node.body) {
          if (
            stmt.type === "ExpressionStatement" &&
            stmt.expression.type === "Literal" &&
            stmt.expression.value === "use client"
          ) {
            isClientComponent = true;
            break;
          }
        }
      },
      ImportDeclaration(node) {
        if (!isClientComponent) return;
        const source = node.source.value;
        if (
          restrictedSet.has(source) ||
          source.startsWith("server-only") ||
          source.includes("/server/") ||
          source.endsWith("/server")
        ) {
          context.report({
            node,
            messageId: "noServerImport",
            data: { name: source },
          });
        }
      },
    };
  },
};

export default noServerImportsInClient;
