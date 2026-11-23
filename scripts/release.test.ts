import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import { runCommand } from "../src/command.ts";

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test.skipIf(process.platform === "win32").each([
  { scenario: "delayed", success: true, attempts: 2, verified: 5, error: "no attestations found" },
  {
    scenario: "unavailable",
    success: false,
    attempts: 12,
    verified: 0,
    error: "no attestations found",
  },
  {
    scenario: "mismatch",
    success: false,
    attempts: 2,
    verified: 0,
    error: "does not contain subject",
  },
])(
  "verifies release assets when attestations are $scenario",
  async ({ scenario, success, attempts, verified, error }) => {
    const workflow = await readFile(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    );
    const step = workflow.split("      - name: Attach assets to a draft and publish\n")[1];
    const script = step
      .split("        run: |\n")[1]
      .split("\n  publish-feature:")[0]
      .replace(/^ {10}/gm, "");
    const dir = await mkdtemp(join(tmpdir(), "shell-config-release-test-"));
    tempDirs.push(dir);
    const bin = join(dir, "bin");
    const assets = [
      "afcms-shell-config-0.0.1.tgz",
      "shell-config.cdx.json",
      "shell-config-linux-x64",
      "shell-config-linux-arm64",
      "shell-config-win-x64.exe",
    ];
    await mkdir(bin);
    await mkdir(join(dir, "artifacts"));
    await writeFile(join(dir, "calls"), "");
    await writeFile(join(dir, "verified"), "");
    await Promise.all(assets.map((asset) => writeFile(join(dir, "artifacts", asset), "fixture")));
    await writeFile(
      join(bin, "gh"),
      `#!/bin/bash
set -eu
case "$2" in
  view) printf 'true\\n' ;;
  upload) ;;
  edit) touch published ;;
  verify)
    test -e published
    printf 'verify\\n' >> calls
    if [[ "$SCENARIO" == unavailable || ! -e ready ]]; then
      touch ready
      printf 'no attestations found for tag v0.0.1\\n' >&2
      exit 1
    fi
    ;;
  verify-asset)
    if [[ ! -e ready ]]; then
      printf 'no attestations found for tag v0.0.1\\n' >&2
      exit 1
    fi
    if [[ "$SCENARIO" == mismatch ]]; then
      printf 'attestation does not contain subject\\n' >&2
      exit 1
    fi
    printf '%s\\n' "$4" >> verified
    ;;
  *) exit 99 ;;
esac
`,
      { mode: 0o755 },
    );
    await writeFile(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const result = await runCommand(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
      {
        cwd: dir,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          GITHUB_REF_NAME: "v0.0.1",
          TARBALL: assets[0],
          REGISTRY_TAG: "latest",
          SCENARIO: scenario,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.success).toBe(success);
    expect(result.stderr).toContain(error);
    expect((await readFile(join(dir, "verified"), "utf8")).split("\n").filter(Boolean)).toEqual(
      assets.slice(0, verified).map((asset) => `artifacts/${asset}`),
    );
    expect((await readFile(join(dir, "calls"), "utf8")).split("\n").filter(Boolean)).toHaveLength(
      attempts,
    );
  },
);
