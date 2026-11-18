import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";

export async function which(command: string): Promise<string | null> {
  const windows = process.platform === "win32";
  const name = windows && !command.toLowerCase().endsWith(".exe") ? command + ".exe" : command;
  const candidates = isAbsolute(name)
    ? [name]
    : (process.env.PATH || "")
        .split(delimiter)
        .filter(Boolean)
        .map((dir) => resolve(dir, name));
  if (windows && !isAbsolute(name)) {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    if (localAppData) candidates.push(join(localAppData, "Microsoft", "WindowsApps", name));
    if (programFiles && name === "pwsh.exe")
      candidates.push(join(programFiles, "PowerShell", "7", name));
  }
  for (const candidate of candidates) {
    try {
      await access(candidate, windows ? constants.F_OK : constants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      // Windows app execution aliases are reparse points and may not stat normally.
      if (windows) {
        try {
          await access(candidate, constants.F_OK);
          return candidate;
        } catch {
          continue;
        }
      }
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          (error.code === "ENOENT" || error.code === "EACCES" || error.code === "ENOTDIR")
        )
      )
        throw error;
    }
  }
  return null;
}
