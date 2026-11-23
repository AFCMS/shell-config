import { stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { updateJsoncConfig } from "../config/jsonc.ts";
import type { AppConfigurator } from "./types.ts";

export const configureVSCode: AppConfigurator = async ({ system, fonts }) => {
  const configured = system.os === "linux" ? process.env.XDG_CONFIG_HOME : process.env.APPDATA;
  const configDir =
    configured && isAbsolute(configured)
      ? configured
      : system.os === "linux"
        ? join(system.homeDir, ".config")
        : join(system.homeDir, "AppData", "Roaming");

  for (const name of ["Code", "Code - Insiders"]) {
    const userDir = join(configDir, name, "User");
    const directory = await stat(userDir).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    });
    if (!directory?.isDirectory()) continue;

    const path = join(userDir, "settings.json");
    if (
      await updateJsoncConfig(path, {
        "terminal.integrated.minimumContrastRatio": 1,
        "terminal.integrated.enableImages": true,
        "terminal.integrated.gpuAcceleration": "on",
        "terminal.integrated.fontFamily": `'${fonts.terminal}', monospace`,
        "editor.fontFamily": `'${fonts.editor}', monospace`,
      })
    ) {
      console.log(
        `Configured ${name} user settings at ${path}. Restart VS Code to load new fonts.`,
      );
    }
  }
};
