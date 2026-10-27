import { deleteIfExists } from "@/utils/fs.js";
import { promises as fsp } from "fs";
import path from "path";

export async function cleanupBoilerplate(projectPath, responses = {}) {
  await deleteIfExists(`${projectPath}/public`);
  await deleteIfExists(`${projectPath}/src/assets`);
  await deleteIfExists(`${projectPath}/.oxlintrc.json`);
  await deleteIfExists(`${projectPath}/.provenance.json`);

  const isNext =
    responses?.framework?.name === "next" ||
    responses?.frameworkName === "next" ||
    (await fsp.stat(path.join(projectPath, "next.config.ts")).catch(() => false)) ||
    (await fsp.stat(path.join(projectPath, "next.config.mjs")).catch(() => false)) ||
    (await fsp.stat(path.join(projectPath, "next.config.js")).catch(() => false));

  if (isNext) {
    await deleteIfExists(`${projectPath}/src/main.tsx`);
    await deleteIfExists(`${projectPath}/src/main.jsx`);

    const isPagesRouter =
      responses?.framework?.variant === "pages-router" ||
      responses?.frameworkVariant === "pages-router" ||
      (await fsp.stat(path.join(projectPath, "src", "pages")).catch(() => false));

    if (isPagesRouter) {
      await deleteIfExists(`${projectPath}/src/app`);
    } else {
      await deleteIfExists(`${projectPath}/src/app/App.tsx`);
      await deleteIfExists(`${projectPath}/src/app/App.jsx`);
      await deleteIfExists(`${projectPath}/src/app/hooks`);
      await deleteIfExists(`${projectPath}/src/app/contexts`);
      await deleteIfExists(`${projectPath}/src/app/providers`);
    }
  }
}
