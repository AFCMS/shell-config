# AFCMS - Shell Config

This project is a TypeScript CLI running on Node.js 26 with pnpm 12.

`src/index.ts` is the CLI entry point. Use `pnpm dev` to run it from source. Use `pnpm build` to bundle the application with tsdown and package
standalone executables with Node.js Single Executable Applications (SEA).
Configuration assets are embedded in the executables and loaded through
`src/config/assets.ts`; development reads the original files directly.

The current installer supports Ubuntu and Fedora: Zsh, Oh-My-Zsh, OMZ plugins,
and Zsh/Starship configuration. Windows detection and helper functions exist,
but the Windows installer is not implemented.

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm format:check` before
submitting changes. Tests must use temporary directories and stub package manager
commands rather than installing packages or modifying the developer's home.
