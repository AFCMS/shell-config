import { SystemInfo } from "../system.ts";

export async function installZshConfig(systemInfo: SystemInfo) {
  if (systemInfo.os === "linux") {
    const zshConfig = await import("../config/zsh/.zshrc", {
      with: { type: "text" },
    });

    const installPath = `${systemInfo.homeDir}/.zshrc`;

    await Deno.mkdir(systemInfo.homeDir, { recursive: true });

    const encoder = new TextEncoder();
    const configBytes = encoder.encode(zshConfig.default);

    await Deno.writeFile(installPath, configBytes, {});
  } else {
    throw new Error("Unsupported OS for Zsh configuration");
  }
}
