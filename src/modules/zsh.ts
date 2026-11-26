import { isAbsolute, join } from "node:path";

import { readConfigAsset } from "../config/assets.ts";
import {
  hasStarshipInit,
  hasUncommentedLine,
  readConfigFile,
  readStartupBlock,
} from "../config/files.ts";
import { cloneGitRepository } from "../linux/git.ts";
import { checkOmzInstalled, installPlugins } from "../linux/omz/omz.ts";
import { omzPlugins } from "../linux/omz/omz_plugins.ts";
import type { SystemInfoLinux } from "../system.ts";
import { posixStarshipPath } from "./starship.ts";

export async function installZshConfig(system: SystemInfoLinux): Promise<void> {
  const zdotdir = process.env.ZDOTDIR;
  const path = join(zdotdir && isAbsolute(zdotdir) ? zdotdir : system.homeDir, ".zshrc");
  const profile = readStartupBlock(await readConfigFile(path), await readConfigAsset("zsh"));
  const customOmz = hasUncommentedLine(profile.custom, /\boh-my-zsh\.sh\b/);

  const omz = await checkOmzInstalled(system.homeDir, profile.custom);
  if (!omz && !customOmz) {
    const target = join(system.homeDir, ".oh-my-zsh");
    console.log(`Installing Oh My Zsh in ${target}.`);
    if (!(await cloneGitRepository("https://github.com/ohmyzsh/ohmyzsh.git", target))) {
      throw new Error(`Could not install Oh My Zsh in ${target}.`);
    }
  }
  if (omz || !customOmz) {
    const omzDir = omz ?? join(system.homeDir, ".oh-my-zsh");
    if (!(await installPlugins(omzDir))) throw new Error("Could not install Oh My Zsh plugins.");
  }
  if (customOmz) {
    console.log(
      `Keeping existing Oh My Zsh initialization in ${path}. Curated plugins: ${omzPlugins.map(({ name }) => name).join(", ")}.`,
    );
    if (!omz)
      console.log(
        "Could not locate the custom Oh My Zsh installation. Set ZSH to its directory to install plugins.",
      );
  }

  const lines: string[] = [];
  if (!customOmz) {
    const location =
      omz && omz !== join(system.homeDir, ".oh-my-zsh")
        ? "'" + omz.replaceAll("'", "'\\''") + "'"
        : '"$HOME/.oh-my-zsh"';
    lines.push(
      `export ZSH=${location}`,
      'ZSH_THEME=""',
      "zstyle ':omz:update' mode disabled",
      "plugins=(git vscode zsh-autosuggestions zsh-syntax-highlighting)",
      'fpath+=("${ZSH_CUSTOM:-$ZSH/custom}/plugins/zsh-completions/src")',
      'source "$ZSH/oh-my-zsh.sh"',
      "",
    );
  }
  const customStarship = hasStarshipInit(profile.custom);
  lines.push(posixStarshipPath);
  if (!customStarship)
    lines.push(
      "if command -v starship >/dev/null 2>&1; then",
      '    eval "$(starship init zsh)"',
      "fi",
    );
  await profile.write(lines.join("\n"), customStarship);
}
