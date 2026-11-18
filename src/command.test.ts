import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { runCommand } from "./command.ts";

const tempDirs: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("captures output, preserves literal arguments, and merges the environment", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "shell-config-command-"));
  tempDirs.push(cwd);
  vi.stubEnv("SHELL_CONFIG_PARENT", "inherited");
  const literal = "spaces; $(not-a-shell-command)";
  const result = await runCommand(
    process.execPath,
    [
      "-e",
      `
    const { writeSync } = require("node:fs");
    writeSync(1, JSON.stringify({ cwd: process.cwd(), arg: process.argv[1],
      parent: process.env.SHELL_CONFIG_PARENT, child: process.env.SHELL_CONFIG_CHILD }));
    writeSync(2, "échec");
  `,
      literal,
    ],
    {
      cwd,
      env: { SHELL_CONFIG_CHILD: "override" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  expect(result.success).toBe(true);
  expect(JSON.parse(result.stdout)).toEqual({
    cwd,
    arg: literal,
    parent: "inherited",
    child: "override",
  });
  expect(result.stderr.trim()).toBe("échec");
});

test("reports nonzero exits without treating them as spawn errors", async () => {
  const result = await runCommand(process.execPath, ["-e", "process.exit(7)"], { stdout: "pipe" });
  expect(result).toMatchObject({ success: false, code: 7, signal: null });
});

test("rejects when an executable does not exist", async () => {
  await expect(runCommand("shell-config-missing-executable-674b")).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test.skipIf(process.platform === "win32")("reports termination by signal", async () => {
  const result = await runCommand(process.execPath, ["-e", 'process.kill(process.pid, "SIGTERM")']);
  expect(result).toMatchObject({ success: false, code: null, signal: "SIGTERM" });
});
