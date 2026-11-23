import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { runCommand } from "../../command.ts";
import { download } from "../../download.ts";
import type { SystemInfoLinux } from "../../system.ts";
import { installNerdFonts, nerdFontsRelease, shouldInstallNerdFonts } from "./nerd_fonts.ts";

vi.mock("../../command.ts", () => ({ runCommand: vi.fn<typeof runCommand>() }));
vi.mock("../../download.ts", () => ({ download: vi.fn<typeof download>() }));

const success = { success: true, code: 0, signal: null, stdout: "", stderr: "" } as const;
let homeDir: string;
let fontRoot: string;
let system: SystemInfoLinux;

beforeEach(async () => {
  vi.resetAllMocks();
  homeDir = await mkdtemp(join(tmpdir(), "shell-config-fonts-test-"));
  fontRoot = join(homeDir, ".local", "share", "fonts", "shell-config");
  system = {
    os: "linux",
    distro: "ubuntu",
    packageManager: "deb",
    versionId: "26.04",
    arch: "x86_64",
    user: "alice",
    homeDir,
  };
  vi.stubEnv("XDG_DATA_HOME", undefined);
  vi.stubEnv("LOCALAPPDATA", undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(download).mockImplementation(async (_url, path) => {
    await writeFile(path, "stub archive");
  });
  vi.mocked(runCommand).mockImplementation(async (command, args, options) => {
    if (command === "tar" || command === "tar.exe") {
      const name = basename(args![1]).split(".")[0];
      await writeFile(join(options!.cwd!, `${name}NerdFontMono-Regular.ttf`), `${name} font data`);
      await writeFile(join(options!.cwd!, "LICENSE.txt"), `${name} license`);
    }
    return success;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

test("defaults to fonts on desktops and skips headless Linux", () => {
  expect(shouldInstallNerdFonts(system, {})).toBe(false);
  expect(shouldInstallNerdFonts(system, { DISPLAY: ":0" })).toBe(true);
  expect(shouldInstallNerdFonts(system, { WAYLAND_DISPLAY: "wayland-0" })).toBe(true);
  expect(shouldInstallNerdFonts({ ...system, os: "windows" }, {})).toBe(true);
});

test("installs verified releases with licenses and refreshes the user's font cache", async () => {
  await installNerdFonts(system);
  expect(download).toHaveBeenCalledTimes(2);
  expect(download).toHaveBeenCalledWith(
    `https://github.com/ryanoasis/nerd-fonts/releases/download/${nerdFontsRelease}/Hack.tar.xz`,
    expect.any(String),
    "1d00a1435638084174516975840854368a45ac30bb0bad2c0c49db713b5925f0",
  );
  expect(download).toHaveBeenCalledWith(
    `https://github.com/ryanoasis/nerd-fonts/releases/download/${nerdFontsRelease}/FiraCode.tar.xz`,
    expect.any(String),
    "d83fb093e0e05a531cd6f19886a6ceb884a4fa5ea3b53cf099fc1f30c5b3e47d",
  );
  for (const name of ["Hack", "FiraCode"]) {
    expect(await readFile(join(fontRoot, name, `${name}NerdFontMono-Regular.ttf`), "utf8")).toBe(
      `${name} font data`,
    );
    expect(await readFile(join(fontRoot, name, "LICENSE.txt"), "utf8")).toBe(`${name} license`);
  }
  expect(await readdir(fontRoot)).toEqual(["FiraCode", "Hack"]);
  expect(runCommand).toHaveBeenLastCalledWith("fc-cache", ["-f", fontRoot]);
  await installNerdFonts(system);
  expect(download).toHaveBeenCalledTimes(2);

  await rm(join(fontRoot, "Hack", "HackNerdFontMono-Regular.ttf"));
  await installNerdFonts(system);
  expect(download).toHaveBeenCalledTimes(3);
  expect(await readFile(join(fontRoot, "Hack", "HackNerdFontMono-Regular.ttf"), "utf8")).toBe(
    "Hack font data",
  );
});

test("honors an absolute XDG data directory and ignores relative values", async () => {
  vi.stubEnv("XDG_DATA_HOME", join(homeDir, "custom data"));
  await installNerdFonts(system);
  expect(await readdir(join(homeDir, "custom data", "fonts", "shell-config"))).toEqual([
    "FiraCode",
    "Hack",
  ]);
  vi.stubEnv("XDG_DATA_HOME", "relative");
  await installNerdFonts(system);
  expect(await readdir(fontRoot)).toEqual(["FiraCode", "Hack"]);
});

test("uses ZIP releases and per-user font registration on Windows", async () => {
  const windows = { ...system, os: "windows" } as const;
  const localAppData = join(homeDir, "Local AppData");
  vi.stubEnv("LOCALAPPDATA", localAppData);
  const powerShell = join(homeDir, "PowerShell 7", "pwsh.exe");
  await installNerdFonts(windows, powerShell);
  expect(download).toHaveBeenCalledWith(
    expect.stringMatching(/\/Hack\.zip$/),
    expect.any(String),
    "8ca33a60c791392d872b80d26c42f2bfa914a480f9eb2d7516d9f84373c36897",
  );
  expect(download).toHaveBeenCalledWith(
    expect.stringMatching(/\/FiraCode\.zip$/),
    expect.any(String),
    "7cc4ffd8f7a1fc914cdab7b149808298165ff7a7f40e40d82dea9ebe41e8ca0b",
  );
  expect(runCommand).toHaveBeenLastCalledWith(
    powerShell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", expect.stringContaining("HKCU:")],
    {
      env: {
        SHELL_CONFIG_FONT_DIR: join(localAppData, "Microsoft", "Windows", "Fonts", "shell-config"),
      },
    },
  );
  await expect(installNerdFonts(windows)).rejects.toThrow("PowerShell 7 is required");
});

test("cleans up failed downloads without recording an installation", async () => {
  vi.mocked(download).mockRejectedValue(new Error("SHA-256 verification failed"));
  await expect(installNerdFonts(system)).rejects.toThrow("SHA-256 verification failed");
  expect(await readdir(fontRoot)).toEqual([]);
});

test.each(["failed", "empty"])(
  "rejects %s extraction and removes temporary files",
  async (kind) => {
    vi.mocked(runCommand).mockResolvedValue({ ...success, success: kind !== "failed", code: 1 });
    await expect(installNerdFonts(system)).rejects.toThrow(
      kind === "failed" ? "Could not extract Hack" : "No fonts found",
    );
    expect(await readdir(fontRoot)).toEqual([]);
  },
);

test("retries cache registration after a failure without downloading the fonts again", async () => {
  vi.mocked(runCommand).mockImplementation(async (command, args, options) => {
    if (command === "fc-cache") return { ...success, success: false, code: 1 };
    await mkdir(options!.cwd!, { recursive: true });
    await writeFile(join(options!.cwd!, basename(args![1]) + ".ttf"), "font data");
    return success;
  });
  await expect(installNerdFonts(system)).rejects.toThrow("Could not register Nerd Fonts");
  vi.mocked(runCommand).mockResolvedValue(success);
  await installNerdFonts(system);
  expect(download).toHaveBeenCalledTimes(2);
});
