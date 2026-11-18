import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: true,
  sortPackageJson: true,
  ignorePatterns: [
    "dist",
    "node_modules",
    "coverage",
    "build",
    ".agents",
    "src/config/zsh/**",
    "src/config/starship/**",
    "src/config/fastfetch/**",
    "src/config/powershell/**",
    ".github/workflows/actions.lock",
  ],
});
