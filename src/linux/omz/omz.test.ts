import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { cloneGitRepository, updateGitRepository } from "../git.ts";
import { checkOmzInstalled, installPlugins, updatePlugins } from "./omz.ts";

vi.mock("../git.ts", () => ({
  cloneGitRepository: vi.fn<typeof cloneGitRepository>(),
  updateGitRepository: vi.fn<typeof updateGitRepository>(),
}));
let homeDir: string;
beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), "shell-config-omz-test-"));
  vi.stubEnv("ZSH", "");
  vi.stubEnv("ZSH_CUSTOM", "");
  vi.mocked(cloneGitRepository).mockReset().mockResolvedValue(true);
  vi.mocked(updateGitRepository).mockReset().mockResolvedValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

test("requires an OMZ directory, not just an existing file", async () => {
  const omzDir = join(homeDir, ".oh-my-zsh");
  expect(await checkOmzInstalled(homeDir)).toBeNull();
  await writeFile(omzDir, "not a directory");
  expect(await checkOmzInstalled(homeDir)).toBeNull();
  await rm(omzDir);
  await mkdir(omzDir);
  await writeFile(join(omzDir, "oh-my-zsh.sh"), "");
  expect(await checkOmzInstalled(homeDir)).toBe(omzDir);
});

test("honors an explicit ZSH directory", async () => {
  const customDir = join(homeDir, "custom-omz");
  await mkdir(customDir);
  await writeFile(join(customDir, "oh-my-zsh.sh"), "");
  vi.stubEnv("ZSH", customDir);
  expect(await checkOmzInstalled(homeDir)).toBe(customDir);
});

test("creates plugin directories and clones only missing plugins", async () => {
  const omzDir = join(homeDir, ".oh-my-zsh");
  const installedPlugin = join(omzDir, "custom", "plugins", "zsh-autosuggestions");
  await mkdir(installedPlugin, { recursive: true });
  expect(await installPlugins(omzDir)).toBe(true);
  expect(cloneGitRepository).toHaveBeenCalledTimes(2);
  expect(cloneGitRepository).toHaveBeenCalledWith(
    "https://github.com/zsh-users/zsh-syntax-highlighting",
    join(omzDir, "custom", "plugins", "zsh-syntax-highlighting"),
  );
});

test("reports failed plugin clones", async () => {
  vi.mocked(cloneGitRepository).mockResolvedValue(false);
  expect(await installPlugins(join(homeDir, ".oh-my-zsh"))).toBe(false);
});

test("skips missing plugins and reports failed updates", async () => {
  const omzDir = join(homeDir, ".oh-my-zsh");
  const pluginDir = join(omzDir, "custom", "plugins", "zsh-autosuggestions");
  await mkdir(pluginDir, { recursive: true });
  vi.mocked(updateGitRepository).mockResolvedValue(false);
  expect(await updatePlugins(omzDir)).toBe(false);
  expect(updateGitRepository).toHaveBeenCalledExactlyOnceWith(pluginDir);
});

test("propagates Git launch errors instead of treating a plugin as missing", async () => {
  const omzDir = join(homeDir, ".oh-my-zsh");
  await mkdir(join(omzDir, "custom", "plugins", "zsh-autosuggestions"), { recursive: true });
  vi.mocked(updateGitRepository).mockRejectedValue(new Error("git unavailable"));
  await expect(updatePlugins(omzDir)).rejects.toThrow("git unavailable");
});
