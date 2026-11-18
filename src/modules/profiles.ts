import { isAbsolute, join } from "node:path";

import { runCommand } from "../command.ts";
import { hasStarshipInit, readConfigFile, readStartupBlock } from "../config/files.ts";
import type { SystemInfo } from "../system.ts";
import { posixStarshipPath } from "./starship.ts";

export async function installBashConfig(system: SystemInfo): Promise<void> {
  const profile = readStartupBlock(await readConfigFile(join(system.homeDir, ".bashrc")));
  const existingInit = hasStarshipInit(profile.custom);
  const block = existingInit
    ? posixStarshipPath
    : posixStarshipPath +
      '\nif command -v starship >/dev/null 2>&1; then\n    eval "$(starship init bash)"\nfi';
  await profile.write(block, existingInit);
}

export async function installPowerShellConfig(executable: string): Promise<void> {
  const result = await runCommand(
    executable,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PROFILE.CurrentUserAllHosts"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const path = result.stdout.trim();
  if (!result.success || !isAbsolute(path)) {
    throw new Error(`Could not resolve the PowerShell profile: ${result.stderr.trim() || path}`);
  }
  const profile = readStartupBlock(await readConfigFile(path));
  const existingInit = hasStarshipInit(profile.custom);
  const lines = [
    "if (-not (Get-Command starship -ErrorAction SilentlyContinue)) {",
    '    $shellConfigBin = Join-Path $HOME ".local/bin"',
    "    $env:PATH = $shellConfigBin + [IO.Path]::PathSeparator + $env:PATH",
    "    Remove-Variable shellConfigBin",
    "}",
  ];
  if (!existingInit) {
    lines.push(
      "if (Get-Command starship -ErrorAction SilentlyContinue) {",
      "    Invoke-Expression (&starship init powershell)",
      "}",
    );
  }
  await profile.write(lines.join("\n"), existingInit);
}
