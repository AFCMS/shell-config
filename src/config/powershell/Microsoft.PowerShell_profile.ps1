[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ENV:STARSHIP_CONFIG = "$HOME\Documents\PowerShell\starship.toml"

. ([scriptblock]::Create((starship init powershell --print-full-init | Out-String)))
