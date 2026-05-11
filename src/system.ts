export type Architecture = "x86_64" | "aarch64";

export interface SystemInfoCommon {
  readonly arch: Architecture;
  readonly homeDir: string;
  readonly user: string;
}

export interface SystemInfoWindows {
  readonly os: "windows";
}

export interface SystemInfoUbuntu {
  readonly os: "linux";
  readonly distro: "ubuntu";
  readonly packageManager: "deb";
  readonly versionCodename: string;
}

export interface SystemInfoFedora {
  readonly os: "linux";
  readonly distro: "fedora";
  readonly packageManager: "rpm";
  readonly versionId: number;
}

export type SystemInfo =
  & SystemInfoCommon
  & (
    | SystemInfoWindows
    | SystemInfoUbuntu
    | SystemInfoFedora
  );

export type SystemOs = SystemInfo["os"];

export type PackageManager =
  (SystemInfoUbuntu | SystemInfoFedora)["packageManager"];
