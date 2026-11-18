import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

import { configFiles } from "./src/config/assets.ts";

export default defineConfig({
  entry: { "shell-config": "src/index.ts" },
  format: "esm",
  platform: "node",
  target: "node26",
  minify: true,
  dts: false,
  copy: Object.values(configFiles).map((file) => ({
    from: fileURLToPath(new URL(`./src/config/${file}`, import.meta.url)),
    to: `dist/${dirname(file)}`,
  })),
  publint: { strict: true },
});
