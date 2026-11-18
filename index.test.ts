import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { confirm, multiselect } from "@clack/prompts";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { runCli } from "./src/index.ts";
import { installShells } from "./src/installer.ts";
import { detectSystem } from "./src/system_detection.ts";

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clack/prompts")>()),
  confirm: vi.fn<typeof confirm>(),
  multiselect: vi.fn<typeof multiselect>(),
  intro: vi.fn<() => void>(),
  outro: vi.fn<() => void>(),
}));
vi.mock("./src/system_detection.ts", () => ({ detectSystem: vi.fn<typeof detectSystem>() }));
vi.mock("./src/installer.ts", () => ({ installShells: vi.fn<typeof installShells>() }));

const system = {
  os: "linux",
  distro: "debian",
  versionId: "13",
  packageManager: "deb",
  arch: "x86_64",
  user: "alice",
  homeDir: "/home/alice",
} as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(detectSystem).mockResolvedValue(system);
});
afterEach(() => vi.restoreAllMocks());

test.each(["--help", "-h", "--version", "-v", "--schema"])(
  "%s exits before system detection or installation",
  async (arg) => {
    expect(await runCli([arg])).toBe(0);
    expect(detectSystem).not.toHaveBeenCalled();
    expect(installShells).not.toHaveBeenCalled();
  },
);

test.each([["--unknown"], ["--shell"], ["--shell", "invalid"], ["extra"], []])(
  "rejects invalid non-interactive arguments %j",
  async (...args) => {
    expect(await runCli(args, false)).toBe(1);
    expect(installShells).not.toHaveBeenCalled();
  },
);

test("shell flags override valid JSON config and never prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shell-config-cli-"));
  try {
    const path = join(dir, "config.json");
    await writeFile(path, '{"shells":["zsh"]}');
    expect(await runCli(["--config", path], true)).toBe(0);
    expect(installShells).toHaveBeenLastCalledWith(system, ["zsh"]);
    expect(await runCli(["--config", path, "--shell", "bash,pwsh,bash"], true)).toBe(0);
    expect(installShells).toHaveBeenLastCalledWith(system, ["bash", "pwsh"]);
    expect(multiselect).not.toHaveBeenCalled();
    await writeFile(path, '{"shells":["zsh"],"unknown":true}');
    expect(await runCli(["--config", path], true)).toBe(1);
    expect(installShells).toHaveBeenCalledTimes(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("opens a shell selection and confirms before applying it", async () => {
  vi.mocked(multiselect).mockResolvedValue(["zsh"]);
  vi.mocked(confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  expect(await runCli([], true)).toBe(1);
  expect(installShells).not.toHaveBeenCalled();
  expect(await runCli([], true)).toBe(0);
  expect(installShells).toHaveBeenCalledExactlyOnceWith(system, ["zsh"]);
});

test("validates all selected shells before installing on Windows", async () => {
  const windows = {
    os: "windows",
    arch: "x86_64",
    homeDir: "C:\\Users\\Alice",
    user: "Alice",
  } as const;
  vi.mocked(detectSystem).mockResolvedValue(windows);
  expect(await runCli(["--shell", "pwsh,bash"])).toBe(1);
  expect(installShells).not.toHaveBeenCalled();
  expect(await runCli(["--shell", "pwsh"])).toBe(0);
  expect(installShells).toHaveBeenCalledExactlyOnceWith(windows, ["pwsh"]);
});
