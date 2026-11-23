import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { configureApps } from "./apps/configure.ts";
import { installShells } from "./installer.ts";
import { checkExec } from "./linux/utils/check_exec.ts";
import {
  installLinuxPackages,
  installMicrosoftPowerShell,
  installWingetPackages,
} from "./linux/utils/install_package.ts";
import { installNerdFonts } from "./linux/utils/nerd_fonts.ts";
import { which } from "./linux/utils/which.ts";
import { installBashConfig, installPowerShellConfig } from "./modules/profiles.ts";
import { installStarship, installStarshipConfig } from "./modules/starship.ts";
import { installZshConfig } from "./modules/zsh.ts";
import type { SystemInfoLinux } from "./system.ts";

vi.mock("./apps/configure.ts", () => ({ configureApps: vi.fn<typeof configureApps>() }));
vi.mock("./linux/utils/check_exec.ts", () => ({ checkExec: vi.fn<typeof checkExec>() }));
vi.mock("./linux/utils/install_package.ts", () => ({
  installLinuxPackages: vi.fn<typeof installLinuxPackages>(),
  installMicrosoftPowerShell: vi.fn<typeof installMicrosoftPowerShell>(),
  installWingetPackages: vi.fn<typeof installWingetPackages>(),
}));
vi.mock("./linux/utils/nerd_fonts.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./linux/utils/nerd_fonts.ts")>()),
  installNerdFonts: vi.fn<typeof installNerdFonts>(),
}));
vi.mock("./linux/utils/which.ts", () => ({ which: vi.fn<typeof which>() }));
vi.mock("./modules/profiles.ts", () => ({
  installBashConfig: vi.fn<typeof installBashConfig>(),
  installPowerShellConfig: vi.fn<typeof installPowerShellConfig>(),
}));
vi.mock("./modules/starship.ts", () => ({
  installStarship: vi.fn<typeof installStarship>(),
  installStarshipConfig: vi.fn<typeof installStarshipConfig>(),
}));
vi.mock("./modules/zsh.ts", () => ({ installZshConfig: vi.fn<typeof installZshConfig>() }));

let homeDir: string;
let system: SystemInfoLinux;
const fontFamilies = {
  terminal: "Hack Nerd Font Mono",
  editor: "FiraCode Nerd Font Mono",
} as const;
beforeEach(async () => {
  vi.resetAllMocks();
  homeDir = await mkdtemp(join(tmpdir(), "shell-config-installer-test-"));
  system = {
    os: "linux",
    distro: "ubuntu",
    packageManager: "deb",
    versionId: "26.04",
    arch: "x86_64",
    user: "alice",
    homeDir,
  };
  vi.stubEnv("DISPLAY", undefined);
  vi.stubEnv("WAYLAND_DISPLAY", undefined);
  vi.mocked(which).mockImplementation(async (command) => join(homeDir, command));
  vi.mocked(checkExec).mockResolvedValue({ path: join(homeDir, "pwsh"), version: "7" });
  vi.mocked(installNerdFonts).mockResolvedValue(fontFamilies);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

test("skips fonts and their dependencies on headless Linux", async () => {
  await installShells(system, ["bash"]);
  expect(installNerdFonts).not.toHaveBeenCalled();
  expect(configureApps).not.toHaveBeenCalled();
  expect(installLinuxPackages).toHaveBeenCalledExactlyOnceWith(system, []);
});

test.each(["deb", "rpm"] as const)(
  "installs missing font tools with %s packages",
  async (packageManager) => {
    const linux: SystemInfoLinux =
      packageManager === "deb"
        ? system
        : {
            ...system,
            distro: "fedora",
            packageManager: "rpm",
            versionId: "45",
          };
    vi.mocked(which).mockImplementation(async (command) =>
      command === "bash" ? join(homeDir, command) : null,
    );
    await installShells(linux, ["bash"], true);
    expect(installLinuxPackages).toHaveBeenCalledExactlyOnceWith(linux, [
      "fontconfig",
      "tar",
      packageManager === "deb" ? "xz-utils" : "xz",
    ]);
    expect(installNerdFonts).toHaveBeenCalledExactlyOnceWith(linux, undefined);
    expect(configureApps).toHaveBeenCalledExactlyOnceWith({ system: linux, fonts: fontFamilies });
    expect(vi.mocked(installNerdFonts).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(configureApps).mock.invocationCallOrder[0],
    );
  },
);

test("allows font installation to be disabled on a Linux desktop", async () => {
  vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
  await installShells(system, ["bash"], false);
  expect(installNerdFonts).not.toHaveBeenCalled();
  expect(configureApps).not.toHaveBeenCalled();
  expect(installLinuxPackages).toHaveBeenCalledExactlyOnceWith(system, []);
  await installShells(system, ["bash"]);
  expect(installNerdFonts).toHaveBeenCalledExactlyOnceWith(system, undefined);
});

test("registers Windows fonts with the detected PowerShell executable", async () => {
  const windows = { ...system, os: "windows" } as const;
  await installShells(windows, ["pwsh"]);
  expect(installNerdFonts).toHaveBeenCalledExactlyOnceWith(windows, join(homeDir, "pwsh"));
  expect(configureApps).toHaveBeenCalledExactlyOnceWith({ system: windows, fonts: fontFamilies });
  expect(installWingetPackages).not.toHaveBeenCalled();
});

test("does not configure apps when font installation or registration fails", async () => {
  vi.mocked(installNerdFonts).mockRejectedValue(new Error("Could not register Nerd Fonts"));
  await expect(installShells(system, ["bash"], true)).rejects.toThrow(
    "Could not register Nerd Fonts",
  );
  expect(configureApps).not.toHaveBeenCalled();
});
