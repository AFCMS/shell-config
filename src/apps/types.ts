import type { SystemInfo } from "../system.ts";

export interface AppConfigContext {
  readonly system: SystemInfo;
  /** Families available after successful font installation and registration. */
  readonly fonts: {
    readonly terminal: string;
    readonly editor: string;
  };
}

/** Each app detects its own user configuration and leaves absent apps alone. */
export type AppConfigurator = (context: AppConfigContext) => Promise<void>;
