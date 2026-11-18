import { homedir, userInfo } from "node:os";
import { isAbsolute } from "node:path";

import { runCommand } from "./command.ts";
import { getOsRelease } from "./os-release.ts";
import type { Architecture, SystemInfo } from "./system.ts";

interface DetectionOptions {
  readonly arch?: string;
  readonly platform?: NodeJS.Platform;
  readonly env?: Readonly<NodeJS.ProcessEnv>;
  readonly uid?: number;
}

export async function detectSystem({
  arch = process.arch,
  platform = process.platform,
  env = process.env,
  uid = process.getuid?.(),
}: DetectionOptions = {}): Promise<SystemInfo | null> {
  if (arch !== "x64" && arch !== "arm64") return null;

  const systemArch: Architecture = arch === "x64" ? "x86_64" : "aarch64";
  if (platform === "win32") {
    return {
      os: "windows",
      arch: systemArch,
      homeDir: env.USERPROFILE || homedir(),
      user: env.USERNAME || userInfo().username,
    };
  }
  if (platform !== "linux") return null;

  const release = await getOsRelease();
  const distro = release?.ID;
  const versionId = release?.VERSION_ID;
  if (
    (distro !== "ubuntu" && distro !== "debian" && distro !== "fedora") ||
    !versionId ||
    !/^\d+(?:\.\d+)?$/.test(versionId)
  ) {
    return null;
  }

  const ordinaryUser = { user: env.USER || userInfo().username, homeDir: env.HOME || homedir() };
  const target = uid === 0 && env.SUDO_USER ? await readLinuxAccount(env.SUDO_USER) : ordinaryUser;
  if (!isAbsolute(target.homeDir))
    throw new Error("The target user's home must be an absolute path.");
  const common = { os: "linux", arch: systemArch, versionId, ...target } as const;
  if (distro === "fedora") return { ...common, distro, packageManager: "rpm" };
  return { ...common, distro, packageManager: "deb" };
}

async function readLinuxAccount(user: string) {
  const result = await runCommand("getent", ["passwd", "--", user], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [name, , uid, gid, , homeDir] = result.stdout.trimEnd().split(":");
  if (!result.success || name !== user || !/^\d+$/.test(uid) || !/^\d+$/.test(gid) || !homeDir) {
    throw new Error(`Could not resolve Linux account ${user}.`);
  }
  const memberships = await runCommand("id", ["-G", "--", user], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!memberships.success || !/^\d+(?: +\d+)*$/.test(memberships.stdout.trim())) {
    throw new Error(`Could not resolve Linux account groups for ${user}.`);
  }
  const groups = memberships.stdout.trim().split(/ +/).map(Number);
  return { user, homeDir, targetIdentity: { uid: Number(uid), gid: Number(gid), groups } };
}
