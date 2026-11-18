export type Architecture = "x86_64" | "aarch64";

export interface SystemInfoCommon {
  readonly arch: Architecture;
  readonly homeDir: string;
  readonly user: string;
}

interface TargetIdentity {
  readonly uid: number;
  readonly gid: number;
  readonly groups: readonly number[];
}

export interface SystemInfoWindows extends SystemInfoCommon {
  readonly os: "windows";
}

export type SystemInfoLinux = SystemInfoCommon & {
  readonly os: "linux";
  readonly targetIdentity?: TargetIdentity;
} & (
    | {
        readonly distro: "ubuntu" | "debian";
        readonly packageManager: "deb";
        readonly versionId: string;
      }
    | {
        readonly distro: "fedora";
        readonly packageManager: "rpm";
        readonly versionId: string;
      }
  );

export type SystemInfo = SystemInfoWindows | SystemInfoLinux;
export type SystemOs = SystemInfo["os"];
export type PackageManager = SystemInfoLinux["packageManager"];
