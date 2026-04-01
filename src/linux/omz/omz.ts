// https://github.com/topgrade-rs/topgrade/blob/325a97384238f2748e91b81436c0a3bce0cdeeee/src/steps/zsh.rs#L144

import { cloneGitRepository, updateGitRepository } from "../git.ts";
import { omzPlugins } from "./omz_plugins.ts";

export async function checkOmzInstalled(
  homeDir: string,
): Promise<string | null> {
  const omzDir = Deno.env.get("ZSH") || `${homeDir}/.oh-my-zsh`;

  try {
    const info = await Deno.stat(omzDir);
    if (!info.isDirectory) {
      return null;
    }
    return omzDir;
  } catch {
    return null;
  }
}

export async function updateOmz(omzDir: string): Promise<boolean> {
  const omzCommand = new Deno.Command("sh", {
    args: [`${omzDir}/tools/upgrade.sh`],
    cwd: omzDir,
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
  });
  const output = await omzCommand.output();
  return output.success;
}

export async function ensurePluginsDirectory(
  omzDir: string,
): Promise<string> {
  const pluginsDir = `${omzDir}/custom/plugins`;

  try {
    await Deno.stat(pluginsDir);
  } catch {
    // Directory doesn't exist, create it
    await Deno.mkdir(pluginsDir, { recursive: true });
  }

  return pluginsDir;
}

export async function installPlugins(omzDir: string): Promise<boolean> {
  const pluginsDir = await ensurePluginsDirectory(omzDir);
  let allSuccess = true;

  for (const plugin of omzPlugins) {
    const pluginPath = `${pluginsDir}/${plugin.name}`;

    try {
      await Deno.stat(pluginPath);
      console.log(`Plugin ${plugin.name} already installed, skipping...`);
    } catch {
      // Plugin doesn't exist, clone it
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
  const pluginsDir = `${omzDir}/custom/plugins`;
  let allSuccess = true;

  for (const plugin of omzPlugins) {
    const pluginPath = `${pluginsDir}/${plugin.name}`;

    try {
      await Deno.stat(pluginPath);
      console.log(`Updating plugin ${plugin.name}...`);
      const success = await updateGitRepository(pluginPath);
      if (!success) {
        console.error(`Failed to update plugin ${plugin.name}`);
        allSuccess = false;
      }
    } catch {
      console.log(`Plugin ${plugin.name} not found, will install next run...`);
    }
  }

  return allSuccess;
}
