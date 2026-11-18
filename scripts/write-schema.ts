import { mkdir, writeFile } from "node:fs/promises";

import { renderConfigSchema } from "../src/config/options.ts";

await mkdir("build/npm", { recursive: true });
await writeFile("dist/shell-config.schema.json", renderConfigSchema() + "\n");
