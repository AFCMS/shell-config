import { readFile } from "node:fs/promises";
import { getAsset, isSea } from "node:sea";

export const configFiles = {
  zsh: "zsh/.zshrc",
  starship: "starship/starship.toml",
} as const;

export async function readConfigAsset(name: keyof typeof configFiles): Promise<string> {
  if (isSea()) {
    return getAsset(name, "utf8");
  }
  return readFile(new URL(`./${configFiles[name]}`, import.meta.url), "utf8");
}
