---
name: shell-config
description: Use the AFCMS shell-config CLI to set up Zsh with Oh My Zsh, Bash, or PowerShell 7 with Starship.
disable-model-invocation: true
license: MIT
compatibility: Only works on Linux, Windows and WSL.
---

# Shell Config

Use `pnpm exec shell-config` when `@afcms/shell-config` is installed in the project, or `pnpm dlx @afcms/shell-config` to run it from npm. The npm CLI requires Node.js 26 or newer. If a standalone `shell-config` executable is available, run it directly.

Run with no flags in a terminal for interactive selection. For unattended runs, pass `--shell zsh,bash` with the requested targets, or `--config <file>` with JSON such as `{"shells":["zsh","bash"]}`. Use `--help` for CLI options and `--schema` for the JSON Schema. Debian, Ubuntu, and Fedora support `zsh`, `bash`, and `pwsh`. Windows supports `pwsh`.

The installer updates the target user's shell profiles and shared Starship configuration and can install missing dependencies. After a successful run, open a new shell to load the profile.
