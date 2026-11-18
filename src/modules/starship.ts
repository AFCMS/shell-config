import { chmod, link, mkdir, mkdtemp, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { runCommand } from "../command.ts";
import { readConfigAsset } from "../config/assets.ts";
import { backupConfigFile, readConfigFile, writeConfigFile } from "../config/files.ts";
import { download } from "../download.ts";
import { checkExec } from "../linux/utils/check_exec.ts";
import type { SystemInfo } from "../system.ts";

const archives = {
  linux: {
    x86_64: [
      "x86_64-unknown-linux-musl.tar.gz",
      "10c8eb4cb3b761d9bf59ea828444c2dab36c900b7d69a69e08814b286969df89",
    ],
    aarch64: [
      "aarch64-unknown-linux-musl.tar.gz",
      "341f5cbf24699fa0b27ec88965ad25f862ea09e15d35a543fd6ffdff1d2aa00d",
    ],
  },
  windows: {
    x86_64: [
      "x86_64-pc-windows-msvc.zip",
      "7764f861805376af2812dd78c84fadc16b714cf3f346baed9b597bfda8484403",
    ],
    aarch64: [
      "aarch64-pc-windows-msvc.zip",
      "1822b6cf1af28071b056976d3f445359d61df324918ffe76c6d0f851eef9366f",
    ],
  },
} as const;

export const posixStarshipPath = [
  'if ! command -v starship >/dev/null 2>&1 && [ -x "$HOME/.local/bin/starship" ]; then',
  '    export PATH="$HOME/.local/bin:$PATH"',
  "fi",
].join("\n");

export async function installStarship(system: SystemInfo): Promise<void> {
  if (await checkExec("starship")) return;
  const name = system.os === "windows" ? "starship.exe" : "starship";
  const bin = join(system.homeDir, ".local", "bin");
  const target = join(bin, name);
  if (await checkExec(target)) return;

  await mkdir(bin, { recursive: true });
  const dir = await mkdtemp(join(bin, ".starship-"));
  try {
    const [asset, checksum] = archives[system.os][system.arch];
    const archive = join(dir, "starship-" + asset);
    console.log("Installing Starship from its official release.");
    await download(
      `https://github.com/starship/starship/releases/download/v1.27.0/starship-${asset}`,
      archive,
      checksum,
    );
    const extraction = await runCommand(
      system.os === "windows" ? "tar.exe" : "tar",
      ["-xf", archive],
      { cwd: dir },
    );
    if (!extraction.success) throw new Error("Could not extract the Starship release.");
    const executable = join(dir, name);
    await chmod(executable, 0o755);
    try {
      await link(executable, target);
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST" &&
          (await checkExec(target))
        )
      )
        throw error;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function installStarshipConfig(system: SystemInfo): Promise<void> {
  const configured = process.env.STARSHIP_CONFIG;
  const path =
    configured && isAbsolute(configured)
      ? configured
      : join(system.homeDir, ".config", "starship.toml");
  const config = await readConfigAsset("starship");
  const file = await readConfigFile(path);
  if (file.text !== undefined && file.text !== config) {
    await backupConfigFile(file);
    console.log(`Replacing Starship configuration at ${path}. Backup: ${file.path}.bak`);
  }
  await writeConfigFile({ ...file, encoding: "utf8" }, config);
}
