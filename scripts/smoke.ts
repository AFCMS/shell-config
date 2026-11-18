import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { runCommand } from "../src/command.ts";
import { omzPlugins } from "../src/linux/omz/omz_plugins.ts";

const binaryArg = process.argv[2];
if (!binaryArg) throw new Error("Usage: node scripts/smoke.ts <executable or npm entry point>");
const binary = resolve(binaryArg);
const windows = process.platform === "win32";
const workDir = await mkdtemp(join(tmpdir(), "shell-config-smoke-"));
try {
  const home = join(workDir, "home");
  const bin = join(workDir, "bin");
  const profile = join(home, "profile.ps1");
  const config = join(workDir, "config.json");
  await mkdir(bin);
  await mkdir(home);
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      [
        "PATH",
        "HOME",
        "USERPROFILE",
        "SUDO_USER",
        "ZDOTDIR",
        "ZSH",
        "ZSH_CUSTOM",
        "STARSHIP_CONFIG",
      ].includes(key.toUpperCase())
    )
      delete env[key];
  }
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    USER: "smoke",
    SUDO_USER: "",
    ZDOTDIR: "",
    ZSH: "",
    ZSH_CUSTOM: "",
    STARSHIP_CONFIG: "",
    PATH: bin,
    SHELL_CONFIG_SMOKE_PROFILE: profile,
  });

  if (windows) {
    const stub = join(bin, "pwsh.exe");
    const compiler = join(workDir, "compile.ps1");
    await writeFile(
      compiler,
      `param([string]$OutputPath)
$source = @'
using System;
public class SmokeStub {
  public static int Main(string[] args) {
    if (args.Length == 1 && args[0] == "--version") {
      Console.WriteLine("smoke stub");
      return 0;
    }
    if (Array.IndexOf(args, "$PROFILE.CurrentUserAllHosts") >= 0) {
      Console.WriteLine(Environment.GetEnvironmentVariable("SHELL_CONFIG_SMOKE_PROFILE"));
      return 0;
    }
    return 1;
  }
}
'@
Add-Type -TypeDefinition $source -OutputAssembly $OutputPath -OutputType ConsoleApplication -ErrorAction Stop
`,
    );
    const desktopPowerShell = join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const result = await runCommand(desktopPowerShell, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      compiler,
      stub,
    ]);
    if (!result.success) throw new Error("Could not compile Windows smoke stubs");
    await copyFile(stub, join(bin, "starship.exe"));
    await writeFile(config, '{"shells":["pwsh"]}');
  } else {
    await chmod(binary, 0o755);
    const omz = join(home, ".oh-my-zsh");
    for (const { name } of omzPlugins) {
      await mkdir(join(omz, "custom", "plugins", name), { recursive: true });
    }
    await writeFile(join(omz, "oh-my-zsh.sh"), "");
    for (const command of ["zsh", "bash", "git", "starship"]) {
      await writeFile(join(bin, command), '#!/bin/sh\nprintf "%s\\n" "smoke stub"\n', {
        mode: 0o755,
      });
    }
    await writeFile(
      join(bin, "pwsh"),
      `#!/bin/sh
if [ "$1" = "--version" ]; then
    printf '%s\\n' 'PowerShell 7 (smoke stub)'
else
    printf '%s\\n' "$SHELL_CONFIG_SMOKE_PROFILE"
fi
`,
      { mode: 0o755 },
    );
    for (const command of ["apt-get", "dnf", "sudo"]) {
      await writeFile(join(bin, command), "#!/bin/sh\nexit 99\n", { mode: 0o755 });
    }
    await writeFile(config, '{"shells":["bash","zsh","pwsh"]}');
  }

  const npm = binary.endsWith(".mjs");
  const args = ["--config", config];
  const result = await runCommand(npm ? process.execPath : binary, npm ? [binary, ...args] : args, {
    env,
    cwd: npm ? dirname(binary) : workDir,
  });
  if (!result.success)
    throw new Error(`Installer smoke test exited with ${result.code ?? result.signal}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
