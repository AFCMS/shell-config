export type SystemOs = "linux" | "windows";
export type PackageManager = "deb" | "rpm";
export type Architecture = "x86_64" | "aarch64";

export interface SystemInfoWindows {
  readonly os: "windows";
  readonly arch: Architecture;
}

export interface SystemInfoLinux {
  readonly os: "linux";
  readonly packageManager: PackageManager;
  readonly arch: Architecture;
  readonly homeDir: string;
  readonly user: string;
}

export type SystemInfo = SystemInfoWindows | SystemInfoLinux;
