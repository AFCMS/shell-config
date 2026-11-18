#!/usr/bin/env node

import { confirm, intro, isCancel, multiselect, outro } from "@clack/prompts";
import { cac } from "cac";

import packageInfo from "../package.json" with { type: "json" };
import {
  parseShellFlag,
  readInstallerConfig,
  renderConfigSchema,
  shellTargets,
  type ShellTarget,
} from "./config/options.ts";
import { installShells } from "./installer.ts";
import { detectSystem } from "./system_detection.ts";

const labels = {
  zsh: "Zsh with Oh My Zsh",
  bash: "Bash",
  pwsh: "PowerShell 7",
} as const satisfies Record<ShellTarget, string>;

export async function runCli(
  args: readonly string[] = [],
  terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY),
): Promise<number> {
  const cli = cac("shell-config");
  cli.usage("[options]");
  cli.option("--shell <shells>", "Comma-separated shell targets: zsh, bash, pwsh");
  cli.option("--config <file>", "Read options from a JSON file");
  cli.option("--schema", "Print the JSON Schema");
  cli.help();
  cli.option("-v, --version", "Print the version");

  try {
    const { args: positionals, options } = cli.parse([process.execPath, "shell-config", ...args], {
      run: false,
    });
    cli.globalCommand.checkUnknownOptions();
    cli.globalCommand.checkOptionValue();
    if (positionals.length) {
      throw new Error(`Unexpected arguments: ${positionals.join(" ")}`);
    }
    if (options.help) return 0;
    if (options.version) {
      console.log(packageInfo.version);
      return 0;
    }
    if (options.schema) {
      console.log(renderConfigSchema());
      return 0;
    }

    if (Array.isArray(options.config) || Array.isArray(options.shell)) {
      throw new Error("Pass --shell and --config at most once each.");
    }
    const config =
      typeof options.config === "string" ? await readInstallerConfig(options.config) : undefined;
    let selected =
      typeof options.shell === "string" ? parseShellFlag(options.shell) : config?.shells;
    if (!selected && (args.length || !terminal)) {
      throw new Error("Pass --shell or --config to select shells for a non-interactive run.");
    }

    const system = await detectSystem();
    if (!system) throw new Error("Unsupported operating system or architecture.");
    const available = system.os === "windows" ? (["pwsh"] as const) : shellTargets;
    const interactive = !selected;

    if (!selected) {
      intro("AFCMS Shell Config");
      const choice = await multiselect({
        message: `Which shells should be configured for ${system.user}?`,
        options: available.map((value) => ({ value, label: labels[value] })),
        required: true,
      });
      if (isCancel(choice)) return 1;
      const confirmed = await confirm({
        message: `Apply shell configuration in ${system.homeDir}?`,
      });
      if (isCancel(confirmed) || !confirmed) return 1;
      selected = choice;
    }

    const shells = [...new Set(selected)];
    for (const shell of shells) {
      if (!available.some((target) => target === shell)) {
        throw new Error(`${labels[shell]} is unavailable on ${system.os}.`);
      }
    }
    await installShells(system, shells);
    if (interactive) outro("Shell configuration installed.");
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2));
}
