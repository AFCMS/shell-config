import { join, delimiter } from "node:path";

import type { ShellTarget } from "./config/options.ts";
import { checkExec } from "./linux/utils/check_exec.ts";
import {
  installLinuxPackages,
  installMicrosoftPowerShell,
  installWingetPackages,
} from "./linux/utils/install_package.ts";
import { which } from "./linux/utils/which.ts";
import { installBashConfig, installPowerShellConfig } from "./modules/profiles.ts";
import { installStarship, installStarshipConfig } from "./modules/starship.ts";
import { installZshConfig } from "./modules/zsh.ts";
import type { SystemInfo } from "./system.ts";

export async function installShells(
  system: SystemInfo,
  shells: readonly ShellTarget[],
): Promise<void> {
  if (system.os === "linux") {
    const packages: string[] = [];
    for (const shell of shells) {
      if (shell !== "pwsh" && !(await which(shell))) packages.push(shell);
    }
    if (shells.includes("zsh") && !(await which("git"))) packages.push("git");
    if (shells.includes("pwsh") && !(await which("pwsh"))) {
      await installMicrosoftPowerShell(system);
    }
    await installLinuxPackages(system, packages);

    // Limit privileged work to system packages. All user files and Git checkouts
    // are created under the account that will actually use them.
    const target = system.targetIdentity;
    if (target && process.getuid?.() === 0 && target.uid !== 0) {
      process.setgroups?.(target.groups);
      process.setgid?.(target.gid);
      process.setuid?.(target.uid);
      for (const name of ["ZDOTDIR", "ZSH", "ZSH_CUSTOM", "STARSHIP_CONFIG", "XDG_CONFIG_HOME"]) {
        delete process.env[name];
      }
      process.env.HOME = system.homeDir;
      process.env.USER = system.user;
      process.env.LOGNAME = system.user;
      process.env.PATH = [
        join(system.homeDir, ".local", "bin"),
        join(system.homeDir, ".cargo", "bin"),
        process.env.PATH,
      ].join(delimiter);
    }
  } else if (shells.includes("pwsh") && !(await checkExec("pwsh"))) {
    await installWingetPackages(["Microsoft.PowerShell"]);
  }

  const powerShell = shells.includes("pwsh") ? await checkExec("pwsh") : null;
  if (shells.includes("pwsh") && !powerShell) {
    throw new Error(
      "Could not find a working PowerShell 7. Open a new terminal or check that pwsh is in PATH.",
    );
  }
  await installStarship(system);
  for (const shell of shells) {
    if (shell === "bash") await installBashConfig(system);
    if (shell === "zsh" && system.os === "linux") await installZshConfig(system);
    if (shell === "pwsh" && powerShell) await installPowerShellConfig(powerShell.path);
  }
  await installStarshipConfig(system);
}
