#!/bin/sh
set -eu

fail() { printf '%s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Install the Shell Config Feature as root."
feature_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
shells=${SHELLS:-zsh}
default_shell=${DEFAULTSHELL:-}
remote_user=$(id -un -- "${_REMOTE_USER:-root}")

if [ -n "$default_shell" ]; then
    case "$default_shell" in zsh|bash|pwsh) ;; *) fail "Invalid defaultShell: $default_shell" ;; esac
    compact_shells=$(printf '%s' "$shells" | tr -d '[:space:]')
    case ",$compact_shells," in
        *,"$default_shell",*) ;;
        *) fail "defaultShell must be selected in shells." ;;
    esac
fi

case "$(uname -m)" in
    x86_64) asset=shell-config-linux-x64 ;;
    aarch64) asset=shell-config-linux-arm64 ;;
    *) fail "Shell Config supports Linux x64 and ARM64." ;;
esac

. /etc/os-release
case "$ID" in
    debian|ubuntu)
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y --no-install-recommends ca-certificates curl libatomic1 libstdc++6
        ;;
    fedora)
        if ! command -v curl >/dev/null 2>&1; then dnf install -y curl-minimal; fi
        dnf install -y ca-certificates libatomic libstdc++
        if [ -n "$default_shell" ] && ! command -v usermod >/dev/null 2>&1; then
            dnf install -y shadow-utils
        fi
        ;;
    *) fail "Supported Feature base distributions are Debian, Ubuntu and Fedora." ;;
esac

[ -r "$feature_dir/release-version" ] || fail "Prepare the Feature with its release binary checksums."
version=$(cat "$feature_dir/release-version")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
binary="$work/$asset"

if [ -f "$feature_dir/test-binaries/$asset" ]; then
    cp "$feature_dir/test-binaries/$asset" "$binary"
else
    curl -fsSL --retry 3 "https://github.com/AFCMS/shell-config/releases/download/v$version/$asset" -o "$binary"
fi
(cd "$work" && grep "  $asset\$" "$feature_dir/SHA256SUMS" | sha256sum --check --strict)
chmod 0755 "$binary"
SUDO_USER="$remote_user" "$binary" --shell "$shells"
install -m 0755 "$binary" /usr/local/bin/shell-config

if [ -n "$default_shell" ]; then
    shell_path=$(command -v "$default_shell") || fail "Cannot locate $default_shell."
    usermod --shell "$shell_path" "$remote_user"
fi
