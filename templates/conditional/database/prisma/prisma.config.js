import { defineConfig } from "@prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.js",
  },
});
