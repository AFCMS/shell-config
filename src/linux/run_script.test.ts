import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, expect, test } from "vitest";

import { runInlineScript } from "./run_script.ts";

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test.skipIf(process.platform === "win32").each([0, 7])(
  "runs a script with environment overrides and cleans up after exit %i",
  async (exitCode) => {
    const dir = await mkdtemp(join(tmpdir(), "shell-config-script-test-"));
    tempDirs.push(dir);
    const receipt = join(dir, "receipt");
    const result = await runInlineScript(
      `printf '%s\\n' "$SHELL_CONFIG_TEST_VALUE" "$0" > "$SHELL_CONFIG_RECEIPT"\nexit ${exitCode}\n`,
      {
        SHELL_CONFIG_TEST_VALUE: "hello world",
        SHELL_CONFIG_RECEIPT: receipt,
      },
    ).then(
      () => undefined,
      (error: unknown) => String(error),
    );
    expect(result).toBe(exitCode === 0 ? undefined : "Error: Script failed (7)");
    const [value, scriptPath] = (await readFile(receipt, "utf8")).trim().split("\n");
    expect(value).toBe("hello world");
    await expect(access(dirname(scriptPath))).rejects.toMatchObject({ code: "ENOENT" });
  },
);
