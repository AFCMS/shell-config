import { readFile } from "node:fs/promises";

import { z } from "zod";

export const shellTargets = ["zsh", "bash", "pwsh"] as const;
export type ShellTarget = (typeof shellTargets)[number];

const shells = z.array(z.enum(shellTargets)).min(1);

const configSchema = z.strictObject({
  $schema: z.string().optional(),
  shells,
  fonts: z.boolean().optional(),
});

export function renderConfigSchema(): string {
  return JSON.stringify(z.toJSONSchema(configSchema), null, 2);
}

export async function readInstallerConfig(path: string): Promise<z.infer<typeof configSchema>> {
  try {
    const data: unknown = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
    return configSchema.parse(data);
  } catch (error) {
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    throw new Error(`Invalid config file ${path}\n${detail}`, { cause: error });
  }
}

export function parseShellFlag(value: string): ShellTarget[] {
  return shells.parse(value.split(",").map((name) => name.trim()));
}
