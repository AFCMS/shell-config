import type { AppConfigContext, AppConfigurator } from "./types.ts";
import { configureVSCode } from "./vscode.ts";

// Register additional apps here; detection and settings formats belong to each app.
const configurators = [configureVSCode] as const satisfies readonly AppConfigurator[];

export async function configureApps(context: AppConfigContext): Promise<void> {
  for (const configure of configurators) await configure(context);
}
