import { spawn } from "node:child_process";

interface CommandOptions {
  readonly cwd?: string;
  readonly env?: Readonly<NodeJS.ProcessEnv>;
  readonly stdout?: "inherit" | "pipe";
  readonly stderr?: "inherit" | "pipe";
}

export interface CommandResult {
  readonly success: boolean;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runCommand(
  command: string,
  args: readonly string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      shell: false,
      stdio: ["ignore", options.stdout ?? "inherit", options.stderr ?? "inherit"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (data: string) => {
      stdout += data;
    });
    child.stderr?.setEncoding("utf8").on("data", (data: string) => {
      stderr += data;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ success: code === 0, code, signal, stdout, stderr });
    });
  });
}
