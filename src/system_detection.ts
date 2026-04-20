import { getOsRelease } from "./os-release.ts";
import { Architecture, SystemInfo } from "./system.ts";

export async function detectSystem(): Promise<SystemInfo | null> {
  const arch = Deno.build.arch;
  if (arch !== "x86_64" && arch !== "aarch64") {
    return null;
  }

  const systemArch: Architecture = arch;

  if (Deno.build.os === "linux") {
    let homeDir = Deno.env.get("HOME");
    let user = Deno.env.get("USER");
    const sudoUser = Deno.env.get("SUDO_USER");

    // If running under sudo, use the original user's credentials.
    if (sudoUser) {
      user = sudoUser;
      homeDir = `/home/${sudoUser}`;
    }

    const osRelease = await getOsRelease();
    if (!osRelease?.ID) {
      return null;
    }

    if (osRelease.ID === "ubuntu") {
      const versionCodename = osRelease.VERSION_CODENAME ??
        osRelease.UBUNTU_CODENAME;
      if (!versionCodename) {
        return null;
      }

      return {
        os: "linux",
        distro: "ubuntu",
        packageManager: "deb",
        versionCodename,
        arch: systemArch,
        homeDir: homeDir ?? "",
        user: user ?? "",
      };
    }

    if (osRelease.ID === "fedora") {
      const versionId = Number.parseInt(osRelease.VERSION_ID ?? "", 10);
      if (Number.isNaN(versionId)) {
        return null;
      }

      return {
        os: "linux",
        distro: "fedora",
        packageManager: "rpm",
        versionId,
        arch: systemArch,
        homeDir: homeDir ?? "",
        user: user ?? "",
      };
    }
  } else if (Deno.build.os === "windows") {
    return {
      os: Deno.build.os,
      arch: systemArch,
      homeDir: Deno.env.get("USERPROFILE") ?? "",
      user: Deno.env.get("USERNAME") ?? "",
    };
  }

  return null;
}
