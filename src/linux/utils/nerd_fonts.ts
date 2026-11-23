import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";

import { runCommand } from "../../command.ts";
import { download } from "../../download.ts";
import type { SystemInfo } from "../../system.ts";

/**
 * @see https://github.com/ryanoasis/nerd-fonts/releases
 */
export const nerdFontsRelease = "v3.4.0";

const fonts = {
  Hack: {
    linux: "1d00a1435638084174516975840854368a45ac30bb0bad2c0c49db713b5925f0",
    windows: "8ca33a60c791392d872b80d26c42f2bfa914a480f9eb2d7516d9f84373c36897",
  },
  FiraCode: {
    linux: "d83fb093e0e05a531cd6f19886a6ceb884a4fa5ea3b53cf099fc1f30c5b3e47d",
    windows: "7cc4ffd8f7a1fc914cdab7b149808298165ff7a7f40e40d82dea9ebe41e8ca0b",
  },
} as const;

const manifestName = ".shell-config-fonts";
const isFont = (name: string): boolean => /\.(?:ttf|otf)$/i.test(name);

export function shouldInstallNerdFonts(
  system: SystemInfo,
  env: Readonly<NodeJS.ProcessEnv> = process.env,
): boolean {
  return system.os === "windows" || Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

async function alreadyInstalled(dir: string): Promise<boolean> {
  try {
    const [release, ...files] = (await readFile(join(dir, manifestName), "utf8")).split("\n");
    if (
      release !== nerdFontsRelease ||
      !files.length ||
      files.some((name) => basename(name) !== name || !isFont(name))
    )
      return false;
    const entries = await Promise.all(files.map((name) => stat(join(dir, name))));
    return entries.every((entry) => entry.isFile() && entry.size > 0);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

// Register fonts for the current account and load them in the current Windows session.
const registerWindowsFonts = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ShellConfigFonts {
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    public static extern int AddFontResourceEx(string path, uint flags, IntPtr reserved);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool SendNotifyMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
}
'@
$key = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
New-Item -Path $key -Force | Out-Null
Get-ChildItem -LiteralPath $env:SHELL_CONFIG_FONT_DIR -Recurse -File |
    Where-Object { $_.Extension -in '.ttf', '.otf' } |
    ForEach-Object {
        $name = $_.BaseName + ' (TrueType)'
        $registered = Get-ItemPropertyValue -LiteralPath $key -Name $name -ErrorAction SilentlyContinue
        if ($registered -ne $_.FullName) {
            if ([ShellConfigFonts]::AddFontResourceEx($_.FullName, 0, [IntPtr]::Zero) -eq 0) {
                throw "Could not load font $($_.FullName)"
            }
            New-ItemProperty -LiteralPath $key -Name $name -Value $_.FullName -PropertyType String -Force | Out-Null
        }
    }
[ShellConfigFonts]::SendNotifyMessage([IntPtr]0xffff, 0x001d, [UIntPtr]::Zero, [IntPtr]::Zero) | Out-Null
`;

export async function installNerdFonts(system: SystemInfo, powerShell?: string): Promise<void> {
  if (system.os === "windows" && !powerShell) {
    throw new Error("PowerShell 7 is required to register Nerd Fonts on Windows.");
  }
  const configured = system.os === "linux" ? process.env.XDG_DATA_HOME : process.env.LOCALAPPDATA;
  const dataDir =
    configured && isAbsolute(configured)
      ? configured
      : system.os === "linux"
        ? join(system.homeDir, ".local", "share")
        : join(system.homeDir, "AppData", "Local");
  const fontRoot =
    system.os === "linux"
      ? join(dataDir, "fonts", "shell-config")
      : join(dataDir, "Microsoft", "Windows", "Fonts", "shell-config");
  await mkdir(fontRoot, { recursive: true });

  for (const [name, checksums] of Object.entries(fonts)) {
    const target = join(fontRoot, name);
    if (await alreadyInstalled(target)) continue;
    const dir = await mkdtemp(join(fontRoot, ".download-"));
    try {
      const asset = `${name}.${system.os === "linux" ? "tar.xz" : "zip"}`;
      const archive = join(dir, asset);
      const extracted = join(dir, "extracted");
      console.log(`Installing ${name} Nerd Font ${nerdFontsRelease}.`);
      await download(
        `https://github.com/ryanoasis/nerd-fonts/releases/download/${nerdFontsRelease}/${asset}`,
        archive,
        checksums[system.os],
      );
      await mkdir(extracted);
      const result = await runCommand(system.os === "linux" ? "tar" : "tar.exe", ["-xf", archive], {
        cwd: extracted,
      });
      if (!result.success) throw new Error(`Could not extract ${name} Nerd Font.`);
      const entries = (await readdir(extracted, { withFileTypes: true })).filter((entry) =>
        entry.isFile(),
      );
      const fontFiles = entries.filter((entry) => isFont(entry.name)).map((entry) => entry.name);
      if (!fontFiles.length) throw new Error(`No fonts found in ${asset}.`);
      await mkdir(target, { recursive: true });
      // Keep the release's licenses alongside the fonts.
      for (const entry of entries) {
        await copyFile(join(extracted, entry.name), join(target, entry.name));
      }
      await writeFile(join(target, manifestName), [nerdFontsRelease, ...fontFiles].join("\n"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const result =
    system.os === "linux"
      ? await runCommand("fc-cache", ["-f", fontRoot])
      : await runCommand(
          powerShell!,
          ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", registerWindowsFonts],
          { env: { SHELL_CONFIG_FONT_DIR: fontRoot } },
        );
  if (!result.success) throw new Error("Could not register Nerd Fonts for the current user.");
  console.log(
    "Nerd Fonts installed. Select Hack Nerd Font Mono or FiraCode Nerd Font Mono in your terminal settings.",
  );
}
