import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

import { configFiles } from "./src/config/assets.ts";

const assets = Object.fromEntries(
  Object.entries(configFiles).map(([name, file]) => [
    name,
    fileURLToPath(new URL(`./src/config/${file}`, import.meta.url)),
  ]),
);

export default defineConfig({
  entry: { "shell-config": "src/index.ts" },
  format: "esm",
  platform: "node",
  target: "node26",
  minify: true,
  dts: false,
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  outDir: "build/sea-js",
  exe: {
    seaConfig: { useCodeCache: false, useSnapshot: false, assets },
    outDir: "build/sea",
    fileName: "shell-config",
    targets: [
      { platform: "linux", arch: "x64", nodeVersion: process.versions.node },
      { platform: "linux", arch: "arm64", nodeVersion: process.versions.node },
      { platform: "win", arch: "x64", nodeVersion: process.versions.node },
    ],
  },
});
