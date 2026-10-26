import { deleteIfExists } from "@/utils/fs.js";

export async function cleanupBoilerplate(projectPath) {
  await deleteIfExists(`${projectPath}/public`);
  await deleteIfExists(`${projectPath}/src/assets`);
  await deleteIfExists(`${projectPath}/.oxlintrc.json`);
  await deleteIfExists(`${projectPath}/.provenance.json`);
}
