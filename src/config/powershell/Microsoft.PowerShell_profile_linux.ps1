[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ENV:STARSHIP_CONFIG = "$HOME/.config/starship.toml"

. ([scriptblock]::Create((starship init powershell --print-full-init | Out-String)))
