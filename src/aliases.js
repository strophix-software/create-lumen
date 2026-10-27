export function getPathAliases(architecture = "feature-based") {
  if (architecture === "type-based") {
    return {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/ui/*": ["./src/ui/*", "./src/components/ui/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
    };
  }
  if (architecture === "none") {
    return {
      "@/*": ["./src/*"],
    };
  }
  return {
    "@/*": ["./src/*"],
    "@/components/*": ["./src/shared/components/*"],
    "@/ui/*": ["./src/shared/components/ui/*"],
    "@/lib/*": ["./src/lib/*"],
    "@/hooks/*": ["./src/shared/hooks/*"],
  };
}

export function getViteAliases(architecture = "feature-based") {
  if (architecture === "type-based") {
    return [
      { find: "@", replacement: "path.resolve(__dirname, \"src\")" },
      { find: "@/components", replacement: "path.resolve(__dirname, \"src/components\")" },
      { find: "@/ui", replacement: "path.resolve(__dirname, \"src/ui\")" },
      { find: "@/lib", replacement: "path.resolve(__dirname, \"src/lib\")" },
      { find: "@/hooks", replacement: "path.resolve(__dirname, \"src/hooks\")" },
    ];
  }
  if (architecture === "none") {
    return [{ find: "@", replacement: "path.resolve(__dirname, \"src\")" }];
  }
  return [
    { find: "@", replacement: "path.resolve(__dirname, \"src\")" },
    { find: "@/components", replacement: "path.resolve(__dirname, \"src/shared/components\")" },
    { find: "@/ui", replacement: "path.resolve(__dirname, \"src/shared/components/ui\")" },
    { find: "@/lib", replacement: "path.resolve(__dirname, \"src/lib\")" },
    { find: "@/hooks", replacement: "path.resolve(__dirname, \"src/shared/hooks\")" },
  ];
}
