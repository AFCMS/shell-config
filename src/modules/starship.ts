import * as path from "@std/path";

import { installWingetPackages } from "../linux/utils/install_package.ts";
import { SystemInfo } from "../system.ts";

export function installStarship(systemInfo: SystemInfo) {
  if (systemInfo.os === "windows") {
    installWingetPackages(["Starship.Starship"]);
  }
}

export async function installStarshipConfig(systemInfo: SystemInfo) {
  const starshipConfig = await import("../config/starship/starship.toml", {
    with: { type: "text" },
  });

  const installPath = systemInfo.os === "windows"
    ? `${systemInfo.homeDir}\\Documents\\PowerShell\\starship.toml`
    : `${systemInfo.homeDir}/.config/starship.toml`;

  await Deno.mkdir(path.dirname(installPath), { recursive: true });

  const encoder = new TextEncoder();
  const configBytes = encoder.encode(starshipConfig.default);

  await Deno.writeFile(installPath, configBytes, {});
}
