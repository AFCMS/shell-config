export ZSH="$HOME/.oh-my-zsh"

# We use Starship
ZSH_THEME=""

# Disable automatic OMZ updates
zstyle ':omz:update' mode disabled

plugins=(
    # Built-in
    git
    vscode
    # Custom
    zsh-autosuggestions
    zsh-syntax-highlighting
)

eval "$(starship init zsh)"
