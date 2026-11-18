import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommand } from "../../command.ts";
import { download } from "../../download.ts";
import type { SystemInfoLinux } from "../../system.ts";

export async function installLinuxPackages(
  system: SystemInfoLinux,
  packages: readonly string[],
): Promise<void> {
  if (!packages.length) return;
  if (system.packageManager === "deb") {
    await runPackageManager("apt-get", ["update"]);
    await runPackageManager("apt-get", ["install", "-y", ...packages]);
  } else {
    await runPackageManager("dnf", ["install", "-y", ...packages]);
  }
}

export async function installMicrosoftPowerShell(system: SystemInfoLinux): Promise<void> {
  try {
    if (system.packageManager === "deb") {
      const dir = await mkdtemp(join(tmpdir(), "shell-config-microsoft-"));
      try {
        const repo = join(dir, "packages-microsoft-prod.deb");
        await download(
          `https://packages.microsoft.com/config/${system.distro}/${system.versionId}/packages-microsoft-prod.deb`,
          repo,
        );
        await runPackageManager("apt-get", ["install", "-y", repo]);
        await runPackageManager("apt-get", ["update"]);
        const preferences = join(dir, "preferences");
        await writeFile(
          preferences,
          [
            "Package: powershell",
            "Pin: origin packages.microsoft.com",
            "Pin-Priority: 990",
            "",
            "Package: powershell",
            "Pin: version *",
            "Pin-Priority: -1",
            "",
          ].join("\n"),
        );
        await runPackageManager("apt-get", [
          "-o",
          `Dir::Etc::Preferences=${preferences}`,
          "install",
          "-y",
          "powershell",
        ]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } else {
      await runPackageManager("dnf", [
        `--repofrompath=microsoft-powershell,https://packages.microsoft.com/fedora/${system.versionId}/prod/`,
        "--setopt=microsoft-powershell.gpgcheck=1",
        "--setopt=microsoft-powershell.gpgkey=https://packages.microsoft.com/keys/microsoft.asc https://packages.microsoft.com/keys/microsoft-2025.asc",
        "install",
        "-y",
        "--repo=microsoft-powershell",
        "powershell",
      ]);
    }
  } catch (error) {
    throw new Error(
      `PowerShell 7 could not be installed from Microsoft's repositories on ${system.distro} ${system.versionId} (${system.arch}). Install a working pwsh and rerun.\n${String(error)}`,
      { cause: error },
    );
  }
}

export async function installWingetPackages(packageNames: readonly string[]): Promise<void> {
  for (const name of packageNames) {
    await runPackageManager("winget.exe", [
      "install",
      "--id",
      name,
      "--exact",
      "--source",
      "winget",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ]);
  }
}

async function runPackageManager(command: string, args: readonly string[]): Promise<void> {
  console.log(`Running ${command} ${args.join(" ")}`);
  const env = { DEBIAN_FRONTEND: "noninteractive" };
  const needsSudo = process.platform === "linux" && process.getuid?.() !== 0;
  const result = needsSudo
    ? await runCommand("sudo", [
        "-n",
        "--",
        "env",
        "DEBIAN_FRONTEND=noninteractive",
        command,
        ...args,
      ])
    : await runCommand(command, args, { env });
  if (!result.success) {
    throw new Error(
      `${command} failed (${result.code ?? result.signal}).${needsSudo ? " Run sudo -v before retrying if authentication is needed." : ""}`,
    );
  }
}
