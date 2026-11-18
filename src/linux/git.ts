import { opendir } from "node:fs/promises";

import { runCommand } from "../command.ts";

export async function updateGitRepository(path: string) {
  const output = await runCommand("git", ["pull"], { cwd: path });
  return output.success;
}

export function updateGitRepositories(paths: readonly string[]): Promise<boolean[]> {
  return Promise.all(paths.map(updateGitRepository));
}

export async function updateGitRepositoriesInFolder(folderPath: string) {
  for await (const dirEntry of await opendir(folderPath)) {
    console.log(dirEntry.name);
  }
}

export async function cloneGitRepository(repoUrl: string, targetPath: string) {
  const output = await runCommand("git", ["clone", repoUrl, targetPath]);
  return output.success;
}
