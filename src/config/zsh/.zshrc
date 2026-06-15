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

fpath+=${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions/src
autoload -U compinit && compinit

source $ZSH/oh-my-zsh.sh

eval "$(starship init zsh)"
