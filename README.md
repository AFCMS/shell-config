# AFCMS Shell Config

Configure Zsh, Bash, or PowerShell 7 with Starship. Run the installer without flags in a terminal
to select shells interactively.

| Platform               | Shells                  |
| ---------------------- | ----------------------- |
| Debian, Ubuntu, Fedora | Zsh, Bash, PowerShell 7 |
| Windows                | PowerShell 7            |

A missing Bash or Zsh is installed with the system package manager. PowerShell 7 uses
WinGet on Windows and Microsoft's package repositories on Linux. If Microsoft has no package
for the selected distribution and architecture, install a working `pwsh` before running the
installer. A working Starship on `PATH` is reused. Otherwise, the installer verifies the archive
from the official Starship release and installs it in `~/.local/bin`.

Hack and FiraCode Nerd Fonts are installed automatically on Windows and on Linux sessions
with `DISPLAY` or `WAYLAND_DISPLAY` set. Headless Linux runs skip fonts. Font archives come
from Nerd Fonts v3.4.0 and are verified with pinned SHA-256 checksums. After successful font
registration, the installer configures detected VS Code and VS Code Insiders user settings.
For other terminals, select **Hack Nerd Font Mono** or **FiraCode Nerd Font Mono** manually.

## Run the installer

Install from npm with Node.js 26 or newer.

```shell
pnpx @afcms/shell-config
pnpx @afcms/shell-config --shell zsh,bash
pnpx @afcms/shell-config --config shell-config.json
```

To use GitHub Packages, authenticate with a token with package read access and add
`@afcms:registry=https://npm.pkg.github.com` to your npm configuration. The package name
and CLI flags are the same.

The [GitHub releases](https://github.com/AFCMS/shell-config/releases) provide standalone
executables for Linux x64, Linux ARM64, and Windows x64. Use `chmod +x` on Linux before
running a downloaded executable. Linux needs glibc, libstdc++, libatomic, and `tar`.
Run `sudo -v` before installing missing Linux packages if sudo requires authentication.
When launched through sudo, the installer looks up the original account and uses its
permissions for shell config and plugin writes.

```shell
./shell-config-linux-x64 --shell zsh,bash
./shell-config-linux-x64 --shell zsh --fonts
./shell-config-linux-x64 --shell bash --no-fonts
```

```powershell
.\shell-config-win-x64.exe --shell pwsh
```

### JSON configuration

Save this as `shell-config.json`.

```json
{
  "shells": ["zsh", "bash"],
  "fonts": false
}
```

`--shell` and `--config` run unattended. With both options present, `--shell` overrides the
file's shell selection. Run `shell-config --schema` to print the JSON Schema, or use
`dist/shell-config.schema.json` from the npm package.

The optional `fonts` boolean overrides automatic font selection. `--fonts` and `--no-fonts`
override the JSON option. Linux fonts go in `$XDG_DATA_HOME/fonts/shell-config` when
`XDG_DATA_HOME` is absolute, otherwise in `~/.local/share/fonts/shell-config`. Missing
`fontconfig`, `tar`, and XZ tools are installed with the system package manager. Windows fonts
are installed under `%LOCALAPPDATA%\Microsoft\Windows\Fonts\shell-config` and registered for
the current user. Repeated runs reuse complete installations of the pinned release.

When using a remote terminal, also install a Nerd Font on the computer running the terminal
application.

### App settings

After installing fonts, the installer looks for existing `Code/User` and `Code - Insiders/User`
directories under `$XDG_CONFIG_HOME` (or `~/.config`) on Linux and `%APPDATA%` (or
`~/AppData/Roaming`) on Windows. It creates a missing `settings.json` in those directories,
uses **Hack Nerd Font Mono** for the integrated terminal and **FiraCode Nerd Font Mono** for
the editor, sets the terminal minimum contrast ratio to `1`, enables images, and turns GPU
acceleration on. Restart VS Code to load newly installed fonts.

JSONC comments, unrelated settings, indentation and line endings are preserved. The first
previous settings file is saved beside it with a `.bak` suffix. Malformed settings are left
unchanged and reported as an error. Runs that skip font installation leave app settings alone.
Only the local default user settings are configured; remote server settings and named profiles
are left alone.

App support lives in [`src/apps/`](src/apps/). To add an app such as Windows Terminal or
Ptyxis, implement an `AppConfigurator` from [`types.ts`](src/apps/types.ts) and register it in
[`configure.ts`](src/apps/configure.ts). Each app owns detection, supported platforms and its
settings format; it receives the target account and the installed font families. JSONC apps
can reuse [`updateJsoncConfig`](src/config/jsonc.ts).

### Configuration files

The installer updates marked blocks in `.zshrc`, `.bashrc`, and the PowerShell user profile.
Existing Oh My Zsh startup and plugin selections are preserved. The installer populates missing
curated plugins and tells you how to find them when your existing Zsh configuration controls
activation. It migrates an exact copy of the previous bundled `.zshrc` automatically.

The Starship config is shared across the selected shells. The installer uses
`~/.config/starship.toml` or an absolute `STARSHIP_CONFIG` from its environment. If it replaces
different contents, it prints the path and keeps the first previous version next to it with a
`.bak` suffix.

## Dev Container Feature

Use a published version matching an available release. The Feature supports Debian, Ubuntu,
and Fedora, and configures the Dev Container remote user.

```json
{
  "features": {
    "ghcr.io/afcms/shell-config/shell-config:1.0.0": {
      "shells": "zsh,bash",
      "defaultShell": "zsh"
    }
  }
}
```

`shells` defaults to `zsh`. Omit `defaultShell` to leave the remote user's login shell
unchanged. An explicit editor terminal profile takes precedence over the login shell.

## Development and releases

```shell
pnpm install --frozen-lockfile
pnpm dev --help
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build:npm
pnpm build:sea
```

`build:npm` produces the npm tarball in `build/npm/` and checks the package with publint.
The npm CLI uses regular production dependencies. `build:sea` creates three standalone
executables in `build/sea/` with their dependencies and config files embedded. `pnpm build` runs
both scripts. To smoke-test a local build with temporary profiles and stub commands, use
`node scripts/smoke.ts build/sea/shell-config-linux-x64`.

CI uploads the binaries and tarball on every successful build. Push a `v<version>` tag
matching `package.json` to start the release pipeline. All smoke and source checks must
pass before npm staging begins. After staging, CI publishes the same tarball to GitHub
Packages, publishes the immutable GitHub release with all four files, and publishes the
version-matched Dev Container Feature through the Dev Container CLI.

Before the first release, enable **Release immutability** in the GitHub repository settings
and configure the npm package's trusted publisher for `AFCMS/shell-config`, workflow `ci.yml`,
and environment `npm-publish`, with stage publishing enabled. If the package does not yet
exist, an authenticated stage can create the placeholder needed to configure trusted publishing.
Reject that bootstrap stage before the CI run if it used the same version. After CI stages
the release, a maintainer approves it on npm with 2FA. Make the GHCR Feature public after
its first publication so Dev Containers can pull it anonymously.
