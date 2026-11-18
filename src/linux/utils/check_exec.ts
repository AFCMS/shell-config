import { runCommand } from "../../command.ts";
import { which } from "./which.ts";

export interface ExecCheckResult {
  readonly version: string;
  readonly path: string;
}

export async function checkExec(
  command: string,
  versionArg: string = "--version",
): Promise<ExecCheckResult | null> {
  const execPath = await which(command);
  if (!execPath) {
    return null;
  }
  try {
    const output = await runCommand(execPath, [versionArg], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (!output.success) {
      return null;
    }
    const version = output.stdout.split("\n")[0].trim();
    return { version, path: execPath };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
