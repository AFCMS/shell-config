import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import packageInfo from "../package.json" with { type: "json" };

const { version } = packageInfo;
const build = process.argv[2] || "build/sea";
const testing = process.argv[3] === "--test";
const output = "build/devcontainer";
const feature = join(output, "src", "shell-config");

await rm(output, { recursive: true, force: true });
await cp("features", output, { recursive: true });
const metadata = JSON.parse(await readFile(join(feature, "devcontainer-feature.json"), "utf8"));
metadata.version = version;
await writeFile(
  join(feature, "devcontainer-feature.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
await writeFile(join(feature, "release-version"), version + "\n");

const checksums: string[] = [];
for (const asset of ["shell-config-linux-x64", "shell-config-linux-arm64"]) {
  const binary = join(build, asset);
  const sha256 = createHash("sha256");
  for await (const chunk of createReadStream(binary)) sha256.update(chunk);
  checksums.push(`${sha256.digest("hex")}  ${asset}`);
  if (testing) {
    const fixtures = join(feature, "test-binaries");
    await mkdir(fixtures, { recursive: true });
    await cp(binary, join(fixtures, asset));
  }
}
await writeFile(join(feature, "SHA256SUMS"), checksums.join("\n") + "\n");
