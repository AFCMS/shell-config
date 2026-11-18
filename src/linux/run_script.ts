import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommand } from "../command.ts";

export async function runInlineScript(
  script: string,
  env?: Readonly<NodeJS.ProcessEnv>,
): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "shell-config-"));
  try {
    const scriptPath = join(tempDir, "install.sh");
    await writeFile(scriptPath, script, "utf8");
    const output = await runCommand("sh", [scriptPath], { env });
    if (!output.success) {
      throw new Error(`Script failed (${output.code ?? output.signal})`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
