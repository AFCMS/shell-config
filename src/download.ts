import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

export async function download(url: string, path: string, sha256?: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256 && createHash("sha256").update(bytes).digest("hex") !== sha256) {
    throw new Error(`SHA-256 verification failed: ${url}`);
  }
  await writeFile(path, bytes);
}
