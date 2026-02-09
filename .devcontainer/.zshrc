# Rubic2Tripletex Development Container - Zsh Configuration
# This file is sourced after the default oh-my-zsh configuration

# ==============================================================================
# Oh-My-Zsh Plugins
# ==============================================================================
plugins=(
    git
    gitfast
    gh
    node
    npm
    docker
    docker-compose
    1password
    fzf
    history
    sudo
    extract
    colored-man-pages
    command-not-found
    # External plugins (installed by zsh-setup.sh or baked into image)
    # zsh-syntax-highlighting must be last per its documentation
    zsh-autosuggestions
    zsh-completions
    fzf-tab
    zsh-syntax-highlighting
)

# ==============================================================================
# History Configuration
# ==============================================================================
HISTSIZE=50000
SAVEHIST=50000
setopt EXTENDED_HISTORY          # Write timestamps to history
setopt HIST_EXPIRE_DUPS_FIRST    # Expire duplicate entries first
setopt HIST_IGNORE_DUPS          # Don't record duplicates
setopt HIST_IGNORE_ALL_DUPS      # Remove older duplicate entries
setopt HIST_FIND_NO_DUPS         # Don't display duplicates in search
setopt HIST_IGNORE_SPACE         # Don't record entries starting with space
setopt HIST_SAVE_NO_DUPS         # Don't write duplicates to history file
setopt HIST_REDUCE_BLANKS        # Remove superfluous blanks
setopt INC_APPEND_HISTORY        # Add commands immediately
setopt SHARE_HISTORY             # Share history between sessions

# ==============================================================================
# Completion Configuration
# ==============================================================================
autoload -Uz compinit && compinit
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'  # Case insensitive
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}" # Colorized completion
zstyle ':completion:*' menu select                       # Menu selection
zstyle ':completion:*:descriptions' format '[%d]'        # Group descriptions

# fzf-tab configuration
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color=always $realpath'
zstyle ':fzf-tab:complete:*:*' fzf-preview 'bat --color=always --style=numbers --line-range=:500 $realpath 2>/dev/null || ls --color=always $realpath 2>/dev/null || echo $realpath'

# ==============================================================================
# Key Bindings
# ==============================================================================
bindkey '^[[A' up-line-or-history
bindkey '^[[B' down-line-or-history
bindkey '^[OA' up-line-or-history
bindkey '^[OB' down-line-or-history
bindkey '^R' history-incremental-search-backward

# ==============================================================================
# Aliases - Development
# ==============================================================================
# Bun
alias b="bun"
alias bi="bun install"
alias ba="bun add"
alias bd="bun run dev"
alias bb="bun run build"
alias bt="bun test"
alias bx="bunx"

# Drizzle
alias dbg="bun run db:generate"
alias dbm="bun run db:migrate"
alias dbs="bun run db:studio"

# Biome
alias check="bun run check"
alias lint="bun run lint"
alias fmt="bun run format"

# Git (extending oh-my-zsh git plugin)
alias gst="git status"
alias gco="git checkout"
alias gcob="git checkout -b"
alias gp="git push"
alias gpf="git push --force-with-lease"
alias gl="git pull"
alias glog="git log --oneline --graph --decorate -20"
alias grb="git rebase"
alias grbi="git rebase -i"
alias gca="git commit --amend"
alias gcane="git commit --amend --no-edit"

# Vercel
alias v="vercel"
alias vd="vercel dev"
alias vp="vercel --prod"
alias venv="vercel env pull .env.local"

# ==============================================================================
# Aliases - General
# ==============================================================================
alias ll="ls -la"
alias la="ls -A"
alias l="ls -CF"
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias cls="clear"
alias reload="source ~/.zshrc"

# ==============================================================================
# 1Password CLI Integration
# ==============================================================================
if command -v op &> /dev/null; then
    [ -f "$HOME/.config/op/plugins.sh" ] && source "$HOME/.config/op/plugins.sh"

    alias opl="op signin"
    alias ops="op item list"
    alias opg="op item get"

    opsecret() {
        op item get "$1" --fields "$2" 2>/dev/null
    }

    openv() {
        eval $(op inject -i "$1")
    }
fi

# ==============================================================================
# Auth0 CLI Integration
# ==============================================================================
if command -v auth0 &> /dev/null; then
    alias a0="auth0"
    alias a0l="auth0 login"
    alias a0apps="auth0 apps list"
    alias a0apis="auth0 apis list"
    alias a0logs="auth0 logs tail"
    alias a0test="auth0 test login"
fi

# ==============================================================================
# Path Extensions
# ==============================================================================
# Bun
export BUN_INSTALL="$HOME/.bun"
[ -d "$BUN_INSTALL/bin" ] && export PATH="$BUN_INSTALL/bin:$PATH"

# Local bin
[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"

# ==============================================================================
# Environment Variables
# ==============================================================================
export EDITOR="code --wait"
export VISUAL="code --wait"

# Disable telemetry
export NEXT_TELEMETRY_DISABLED=1

# ==============================================================================
# Autosuggestions Configuration
# ==============================================================================
ZSH_AUTOSUGGEST_STRATEGY=(history completion)
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#666666"

# ==============================================================================
# fzf Configuration
# ==============================================================================
if command -v fzf &> /dev/null; then
    export FZF_DEFAULT_OPTS="
        --height 40%
        --layout=reverse
        --border
        --info=inline
        --preview-window=right:50%:wrap
        --bind='ctrl-/:toggle-preview'
    "

    if command -v fd &> /dev/null; then
        export FZF_DEFAULT_COMMAND="fd --type f --hidden --follow --exclude .git --exclude node_modules"
        export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
        export FZF_ALT_C_COMMAND="fd --type d --hidden --follow --exclude .git --exclude node_modules"
    fi
fi

# ==============================================================================
# Utility Functions
# ==============================================================================

# Create and cd into directory
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Quick port check
port() {
    lsof -i ":$1" 2>/dev/null || echo "Port $1 is free"
}

# Kill process on port
killport() {
    local pid=$(lsof -t -i ":$1" 2>/dev/null)
    if [ -n "$pid" ]; then
        kill -9 $pid && echo "Killed process $pid on port $1"
    else
        echo "No process found on port $1"
    fi
}

# Pretty print JSON
json() {
    if [ -t 0 ]; then
        cat "$1" | jq .
    else
        jq .
    fi
}

# ==============================================================================
# Welcome Message (only in interactive shells)
# ==============================================================================
if [[ $- == *i* ]] && [ -z "$WELCOMED" ]; then
    export WELCOMED=1
    echo ""
    echo "Rubic2Tripletex Development Container"
    echo "Type 'help-dev' for available commands"
    echo ""
fi

# Help command
help-dev() {
    echo ""
    echo "=== Rubic2Tripletex Development Commands ==="
    echo ""
    echo "Bun / Development:"
    echo "  b, bi, ba, bd, bb, bt   bun shortcuts"
    echo "  check, lint, fmt         biome shortcuts"
    echo "  dbg, dbm, dbs            drizzle shortcuts"
    echo ""
    echo "Vercel:"
    echo "  v, vd, vp                vercel shortcuts"
    echo "  venv                     pull env vars from vercel"
    echo ""
    echo "1Password:"
    echo "  opl                      sign in"
    echo "  ops                      list items"
    echo "  opg <item>               get item"
    echo "  opsecret <item> <field>  get specific field"
    echo "  openv <file>             inject secrets from file"
    echo ""
    echo "Auth0:"
    echo "  a0                       auth0 cli"
    echo "  a0l                      login to Auth0"
    echo "  a0apps                   list applications"
    echo "  a0apis                   list APIs"
    echo "  a0logs                   tail logs"
    echo "  a0test                   test login flow"
    echo ""
    echo "Utilities:"
    echo "  mkcd <dir>               create and cd into directory"
    echo "  port <num>               check if port is in use"
    echo "  killport <num>           kill process on port"
    echo "  json [file]              pretty print JSON"
    echo ""
}
