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

  const cmd = new Deno.Command(execPath, {
    args: [versionArg],
    stdin: "null",
    stdout: "piped",
  });

  try {
    const output = await cmd.spawn().output();
    const version = new TextDecoder().decode(output.stdout).split("\n")[0]
      .trim();
    return { version, path: execPath };
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return null;
    }
    throw err;
  }
}
