// https://github.com/topgrade-rs/topgrade/blob/325a97384238f2748e91b81436c0a3bce0cdeeee/src/steps/zsh.rs#L144

import { mkdir, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { runCommand } from "../../command.ts";
import { cloneGitRepository, updateGitRepository } from "../git.ts";
import { omzPlugins } from "./omz_plugins.ts";

export async function checkOmzInstalled(homeDir: string, profile = ""): Promise<string | null> {
  const assignment = /^[ \t]*(?:export[ \t]+)?ZSH=(?:"([^"]*)"|'([^']*)'|([^\s#]+))/m.exec(profile);
  const configured = process.env.ZSH || assignment?.[1] || assignment?.[2] || assignment?.[3];
  const omzDir =
    configured?.replace(/^(?:\$HOME|\$\{HOME\}|~)(?=\/)/, homeDir) ?? join(homeDir, ".oh-my-zsh");
  if (!isAbsolute(omzDir)) return null;

  try {
    return (await stat(join(omzDir, "oh-my-zsh.sh"))).isFile() ? omzDir : null;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    )
      return null;
    throw error;
  }
}

export async function updateOmz(omzDir: string): Promise<boolean> {
  const output = await runCommand("sh", [`${omzDir}/tools/upgrade.sh`], { cwd: omzDir });
  return output.success;
}

export async function ensurePluginsDirectory(omzDir: string): Promise<string> {
  const pluginsDir = join(process.env.ZSH_CUSTOM || join(omzDir, "custom"), "plugins");

  await mkdir(pluginsDir, { recursive: true });

  return pluginsDir;
}

export async function installPlugins(omzDir: string): Promise<boolean> {
  const pluginsDir = await ensurePluginsDirectory(omzDir);
  let allSuccess = true;

  for (const plugin of omzPlugins) {
    const pluginPath = join(pluginsDir, plugin.name);

    try {
      await stat(pluginPath);
      console.log(`Plugin ${plugin.name} already installed, skipping...`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      console.log(`Installing plugin ${plugin.name}...`);
      const success = await cloneGitRepository(plugin.url, pluginPath);
      if (!success) {
        console.error(`Failed to install plugin ${plugin.name}`);
        allSuccess = false;
      }
    }
  }

  return allSuccess;
}

export async function updatePlugins(omzDir: string): Promise<boolean> {
  const pluginsDir = join(process.env.ZSH_CUSTOM || join(omzDir, "custom"), "plugins");
  let allSuccess = true;

  for (const plugin of omzPlugins) {
    const pluginPath = join(pluginsDir, plugin.name);

    try {
      await stat(pluginPath);
    } catch {
      console.log(`Plugin ${plugin.name} not found, will install next run...`);
      continue;
    }
    console.log(`Updating plugin ${plugin.name}...`);
    const success = await updateGitRepository(pluginPath);
    if (!success) {
      console.error(`Failed to update plugin ${plugin.name}`);
      allSuccess = false;
    }
  }

  return allSuccess;
}
