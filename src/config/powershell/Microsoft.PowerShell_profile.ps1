[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ENV:STARSHIP_CONFIG = "$HOME\Documents\PowerShell\starship.toml"

Invoke-Expression (&starship init powershell)
