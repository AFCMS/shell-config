import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "jsonc-parser";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { configureApps } from "./configure.ts";
import type { AppConfigContext } from "./types.ts";

let context: AppConfigContext;
let homeDir: string;

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), "shell-config-apps-test-"));
  context = {
    system: {
      os: "linux",
      distro: "ubuntu",
      packageManager: "deb",
      versionId: "26.04",
      arch: "x86_64",
      user: "alice",
      homeDir,
    },
    fonts: { terminal: "Hack Nerd Font Mono", editor: "FiraCode Nerd Font Mono" },
  };
  vi.stubEnv("XDG_CONFIG_HOME", undefined);
  vi.stubEnv("APPDATA", undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

test("leaves absent apps alone", async () => {
  await configureApps(context);
  expect(await readdir(homeDir)).toEqual([]);
});

test("configures detected VS Code and Insiders user settings for the installed fonts", async () => {
  for (const name of ["Code", "Code - Insiders"]) {
    const userDir = join(homeDir, ".config", name, "User");
    await mkdir(userDir, { recursive: true });
    await writeFile(
      join(userDir, "settings.json"),
      '{\n  // Keep my settings\n  "workbench.colorTheme": "Default Dark Modern",\n  "terminal.integrated.fontFamily": "old font",\n}\n',
    );
  }

  await configureApps(context);
  for (const name of ["Code", "Code - Insiders"]) {
    const text = await readFile(join(homeDir, ".config", name, "User", "settings.json"), "utf8");
    expect(text).toContain("// Keep my settings");
    expect(parse(text)).toEqual({
      "workbench.colorTheme": "Default Dark Modern",
      "terminal.integrated.minimumContrastRatio": 1,
      "terminal.integrated.enableImages": true,
      "terminal.integrated.gpuAcceleration": "on",
      "terminal.integrated.fontFamily": "'Hack Nerd Font Mono', monospace",
      "editor.fontFamily": "'FiraCode Nerd Font Mono', monospace",
    });
  }
});

test.each([
  ["linux", "XDG_CONFIG_HOME"],
  ["windows", "APPDATA"],
] as const)("uses an absolute %s app data directory", async (os, env) => {
  if (os === "windows") {
    context = { ...context, system: { os, arch: "x86_64", user: "alice", homeDir } };
  }
  const configDir = join(homeDir, "custom config");
  vi.stubEnv(env, configDir);
  const userDir = join(configDir, "Code", "User");
  await mkdir(userDir, { recursive: true });
  await configureApps(context);
  expect(parse(await readFile(join(userDir, "settings.json"), "utf8"))).toMatchObject({
    "terminal.integrated.fontFamily": "'Hack Nerd Font Mono', monospace",
  });
});

test.each([
  ["linux", "XDG_CONFIG_HOME", ".config"],
  ["windows", "APPDATA", "AppData/Roaming"],
] as const)("uses the target home for %s when app data is relative", async (os, env, fallback) => {
  if (os === "windows") {
    context = { ...context, system: { os, arch: "x86_64", user: "alice", homeDir } };
  }
  vi.stubEnv(env, "relative");
  const userDir = join(homeDir, fallback, "Code", "User");
  await mkdir(userDir, { recursive: true });
  await configureApps(context);
  expect(parse(await readFile(join(userDir, "settings.json"), "utf8"))).toMatchObject({
    "editor.fontFamily": "'FiraCode Nerd Font Mono', monospace",
  });
});
