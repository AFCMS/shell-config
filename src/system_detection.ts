import { SystemInfo } from "./system.ts";

export async function detectSystem(): Promise<SystemInfo | null> {
  if (Deno.build.os === "linux") {
    const debPath = "/etc/debian_version";
    const rpmPath = "/etc/redhat-release";

    let homeDir = Deno.env.get("HOME");
    let user = Deno.env.get("USER");
    const sudoUser = Deno.env.get("SUDO_USER");

    // If running under sudo, use the original user's credentials
    if (sudoUser) {
      user = sudoUser;
      homeDir = `/home/${sudoUser}`;
    }

    if (await Deno.readTextFile(debPath).catch(() => null)) {
      return {
        os: Deno.build.os,
        packageManager: "deb",
        arch: Deno.build.arch,
        homeDir: homeDir ?? "",
        user: user ?? "",
      };
    }

    if (await Deno.readTextFile(rpmPath).catch(() => null)) {
      return {
        os: Deno.build.os,
        packageManager: "rpm",
        arch: Deno.build.arch,
        homeDir: homeDir ?? "",
        user: user ?? "",
      };
    }
  }

  return null;
}
