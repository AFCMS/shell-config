import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { runCommand } from "../command.ts";
import { readConfigAsset } from "../config/assets.ts";
import { endMarker, startMarker } from "../config/files.ts";
import { omzPlugins } from "../linux/omz/omz_plugins.ts";
import type { SystemInfoLinux } from "../system.ts";
import { installBashConfig, installPowerShellConfig } from "./profiles.ts";
import { installStarshipConfig } from "./starship.ts";
import { installZshConfig } from "./zsh.ts";

vi.mock("../command.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../command.ts")>()),
  runCommand: vi.fn<typeof runCommand>(),
}));

let homeDir: string;
let system: SystemInfoLinux;

beforeEach(async () => {
  vi.resetAllMocks();
  homeDir = await mkdtemp(join(tmpdir(), "shell-config-config-test-"));
  system = {
    os: "linux",
    distro: "fedora",
    packageManager: "rpm",
    versionId: "45",
    arch: "x86_64",
    user: "alice",
    homeDir,
  };
  for (const name of ["ZSH", "ZSH_CUSTOM", "ZDOTDIR", "STARSHIP_CONFIG"])
    vi.stubEnv(name, undefined);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

test("loads the original config assets relative to the module", async () => {
  expect(await readConfigAsset("zsh")).toBe(
    await readFile(new URL("../config/zsh/.zshrc", import.meta.url), "utf8"),
  );
  expect(await readConfigAsset("starship")).toBe(
    await readFile(new URL("../config/starship/starship.toml", import.meta.url), "utf8"),
  );
});

test("updates the Bash block in place and preserves surrounding text", async () => {
  const path = join(homeDir, ".bashrc");
  await writeFile(
    path,
    `# before\r\n  # eval "$(starship init bash)"\r\n${startMarker}\r\nprevious\r\n${endMarker}\r\n# after\r\n`,
  );
  await installBashConfig(system);
  const first = await readFile(path, "utf8");
  expect(first).toMatch(/^# before\r\n  # eval [^\r\n]+\r\n# >>> shell-config >>>\r\n/);
  expect(first).toContain('    eval "$(starship init bash)"');
  expect(first).toMatch(/# <<< shell-config <<<\r\n# after\r\n$/);
  await installBashConfig(system);
  expect(await readFile(path, "utf8")).toBe(first);
});

test("migrates an exact legacy Zsh profile and avoids duplicate initialization", async () => {
  const omz = join(homeDir, ".oh-my-zsh");
  for (const { name } of omzPlugins) {
    await mkdir(join(omz, "custom", "plugins", name), { recursive: true });
  }
  await writeFile(join(omz, "oh-my-zsh.sh"), "");
  const path = join(homeDir, ".zshrc");
  await writeFile(path, await readConfigAsset("zsh"));
  await installZshConfig(system);
  const migrated = await readFile(path, "utf8");
  expect(migrated.startsWith(startMarker)).toBe(true);
  expect(migrated.match(/starship init zsh/g)).toHaveLength(1);
  const customized = 'export ZSH="$HOME/.oh-my-zsh"\nplugins=(git)\nsource "$ZSH/oh-my-zsh.sh"\n';
  await writeFile(path, customized);
  await installZshConfig(system);
  expect(await readFile(path, "utf8")).toContain(customized);
  expect((await readFile(path, "utf8")).match(/oh-my-zsh\.sh/g)).toHaveLength(1);
});

test.each([false, true])("detects active Oh My Zsh initialization (custom: %s)", async (custom) => {
  const omz = join(homeDir, ".oh-my-zsh");
  for (const { name } of omzPlugins) {
    await mkdir(join(omz, "custom", "plugins", name), { recursive: true });
  }
  await writeFile(join(omz, "oh-my-zsh.sh"), "");
  const path = join(homeDir, ".zshrc");
  const text =
    " ".repeat(100_000) +
    '\r\n\t# source "$ZSH/oh-my-zsh.sh"\r\n' +
    (custom ? 'source "$ZSH/oh-my-zsh.sh"\r\n' : "");
  await writeFile(path, text);
  await installZshConfig(system);
  const profile = await readFile(path, "utf8");
  expect(profile).toContain(text);
  const block = profile.slice(profile.indexOf(startMarker));
  expect(block.includes('source "$ZSH/oh-my-zsh.sh"')).toBe(!custom);
});

test("backs up the original Starship config once before replacing it", async () => {
  const dir = join(homeDir, ".config");
  const path = join(dir, "starship.toml");
  await mkdir(dir);
  await writeFile(path, "old Starship config");
  await installStarshipConfig(system);
  expect(await readFile(path + ".bak", "utf8")).toBe("old Starship config");
  await writeFile(path, "another edit");
  await installStarshipConfig(system);
  expect(await readFile(path + ".bak", "utf8")).toBe("old Starship config");
  expect(await readFile(path, "utf8")).toBe(await readConfigAsset("starship"));
});

test("generates a PowerShell profile that sources the full Starship script", async () => {
  const path = join(homeDir, "Microsoft.PowerShell_profile.ps1");
  vi.mocked(runCommand).mockResolvedValue({
    success: true,
    code: 0,
    signal: null,
    stdout: path,
    stderr: "",
  });
  await installPowerShellConfig("pwsh");
  const first = await readFile(path, "utf8");
  expect(first).not.toContain("Invoke-Expression");
  expect(first).toContain("starship init powershell --print-full-init");
  await installPowerShellConfig("pwsh");
  expect(await readFile(path, "utf8")).toBe(first);
});

test.each(["Microsoft.PowerShell_profile.ps1", "Microsoft.PowerShell_profile_linux.ps1"])(
  "%s sources the full Starship initialization without Invoke-Expression",
  async (name) => {
    const text = await readFile(new URL(`../config/powershell/${name}`, import.meta.url), "utf8");
    expect(text).not.toContain("Invoke-Expression");
    expect(text).toContain("starship init powershell --print-full-init");
  },
);
