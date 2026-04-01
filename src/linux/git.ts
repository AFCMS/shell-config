export async function updateGitRepository(path: string) {
  const gitCommand = new Deno.Command("git", {
    args: ["pull"],
    cwd: path,
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await gitCommand.output();
  return output.success;
}

export function updateGitRepositories(
  paths: string[],
): Promise<boolean[]> {
  const promises = paths.map(updateGitRepository);
  return Promise.all(promises);
}

export async function updateGitRepositoriesInFolder(folderPath: string) {
  for await (const dirEntry of Deno.readDir(folderPath)) {
    console.log(dirEntry.name);
  }
}

export async function cloneGitRepository(repoUrl: string, targetPath: string) {
  const gitCommand = new Deno.Command("git", {
    args: ["clone", repoUrl, targetPath],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await gitCommand.output();
  return output.success;
}
