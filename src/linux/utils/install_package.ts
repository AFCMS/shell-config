import { PackageManager } from "../../system.ts";
import { packageMappings, PackageName } from "../package_mappings.ts";

export async function updateDebPackagesList() {
  const aptCommand = new Deno.Command("apt", {
    args: ["update"],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await aptCommand.output();
  return output.success;
}

export async function installDebPackages(
  packageNames: PackageName[],
): Promise<boolean> {
  const aptCommand = new Deno.Command("apt", {
    args: [
      "install",
      "-y",
      ...packageNames.map((name) => packageMappings[name].deb),
    ],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await aptCommand.output();
  return output.success;
}

export async function installRpmPackages(
  packageNames: PackageName[],
): Promise<boolean> {
  const dnfCommand = new Deno.Command("dnf", {
    args: [
      "install",
      "-y",
      ...packageNames.map((name) => packageMappings[name].rpm),
    ],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await dnfCommand.output();
  return output.success;
}

export async function installPackages(
  packageNames: PackageName[],
  packageManager: PackageManager,
): Promise<boolean> {
  switch (packageManager) {
    case "deb":
      return await installDebPackages(packageNames);
    case "rpm":
      return await installRpmPackages(packageNames);
  }
}

export async function installWingetPackages(
  packageNames: string[],
) {
  const wingetCommand = new Deno.Command("winget", {
    args: [
      "install",
      "--id",
      ...packageNames,
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });

  const output = await wingetCommand.output();
  return output.success;
}
