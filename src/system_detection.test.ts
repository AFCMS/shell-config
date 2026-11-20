import { beforeEach, expect, test, vi } from "vitest";

import { runCommand } from "./command.ts";
import { getOsRelease } from "./os-release.ts";
import { detectSystem } from "./system_detection.ts";

vi.mock("./os-release.ts", () => ({ getOsRelease: vi.fn<typeof getOsRelease>() }));
vi.mock("./command.ts", () => ({ runCommand: vi.fn<typeof runCommand>() }));

const env = { HOME: "/home/alice", USER: "alice" } as const;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getOsRelease).mockResolvedValue({ ID: "ubuntu", VERSION_ID: "26.04" });
});

test.each([
  ["x64", "x86_64"],
  ["arm64", "aarch64"],
])("maps Node's %s architecture and detects Ubuntu", async (arch, expected) => {
  expect(await detectSystem({ arch, platform: "linux", env })).toEqual({
    os: "linux",
    arch: expected,
    distro: "ubuntu",
    packageManager: "deb",
    versionId: "26.04",
    homeDir: env.HOME,
    user: env.USER,
  });
});

test("resolves the original user and their real home when launched through sudo", async () => {
  const success = { success: true, code: 0, signal: null, stderr: "" } as const;
  vi.mocked(runCommand)
    .mockResolvedValueOnce({ ...success, stdout: "alice:x:1001:1001::/custom/alice:/bin/bash\n" })
    .mockResolvedValueOnce({ ...success, stdout: "1001 1002\n" });
  const result = await detectSystem({
    arch: "x64",
    platform: "linux",
    uid: 0,
    env: { HOME: "/root", USER: "root", SUDO_USER: "alice" },
  });
  expect(result).toMatchObject({
    homeDir: "/custom/alice",
    user: "alice",
    targetIdentity: { uid: 1001, gid: 1001, groups: [1001, 1002] },
  });
});

test.each([
  ["debian", "13", "deb"],
  ["fedora", "45", "rpm"],
])("detects %s and its package manager", async (distro, versionId, packageManager) => {
  vi.mocked(getOsRelease).mockResolvedValue({ ID: distro, VERSION_ID: versionId });
  expect(await detectSystem({ arch: "arm64", platform: "linux", env })).toMatchObject({
    distro,
    packageManager,
    versionId,
    arch: "aarch64",
  });
});

test.each([undefined, { ID: "arch" }, { ID: "ubuntu" }, { ID: "fedora", VERSION_ID: "invalid" }])(
  "rejects missing or unsupported distribution metadata: %j",
  async (osRelease) => {
    vi.mocked(getOsRelease).mockResolvedValue(osRelease);
    expect(await detectSystem({ arch: "x64", platform: "linux", env })).toBeNull();
  },
);

test("maps Windows platform and user environment", async () => {
  expect(
    await detectSystem({
      arch: "x64",
      platform: "win32",
      env: { USERPROFILE: "C:/Users/Alice", USERNAME: "Alice" },
    }),
  ).toEqual({ os: "windows", arch: "x86_64", homeDir: "C:/Users/Alice", user: "Alice" });
  expect(getOsRelease).not.toHaveBeenCalled();
});

test("rejects unsupported architectures and operating systems", async () => {
  expect(await detectSystem({ arch: "ia32", platform: "linux", env })).toBeNull();
  expect(await detectSystem({ arch: "x64", platform: "darwin", env })).toBeNull();
  expect(getOsRelease).not.toHaveBeenCalled();
});
