# Shell behavior: history, completion zstyles, fzf opts, fd/bat compatibility.

# Debian/Ubuntu often use fdfind/batcat instead of fd/bat.
# Define compatibility aliases early and compute real command names for fzf.
if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
  alias fd='fdfind'
fi
if ! command -v bat >/dev/null 2>&1 && command -v batcat >/dev/null 2>&1; then
  alias bat='batcat'
fi

if command -v fd >/dev/null 2>&1; then
  FZF_FD_CMD='fd'
elif command -v fdfind >/dev/null 2>&1; then
  FZF_FD_CMD='fdfind'
else
  FZF_FD_CMD=''
fi

if command -v bat >/dev/null 2>&1; then
  FZF_BAT_CMD='bat'
elif command -v batcat >/dev/null 2>&1; then
  FZF_BAT_CMD='batcat'
else
  FZF_BAT_CMD=''
fi

# History
HISTSIZE=50000
SAVEHIST=50000
HISTFILE="${HISTFILE:-$HOME/.zsh_history}"
setopt EXTENDED_HISTORY
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_SAVE_NO_DUPS
setopt HIST_REDUCE_BLANKS
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY

# Completion (extends .zshrc compinit)
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu select
zstyle ':completion:*:descriptions' format '[%d]'

# fzf-tab previews (when fzf-tab is loaded)
if command -v fzf >/dev/null 2>&1; then
  zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color=always $realpath'

  if [ -n "$FZF_BAT_CMD" ]; then
    zstyle ':fzf-tab:complete:*:*' fzf-preview "$FZF_BAT_CMD --color=always --style=numbers --line-range=:500 \$realpath 2>/dev/null || ls --color=always \$realpath 2>/dev/null || echo \$realpath"
  else
    zstyle ':fzf-tab:complete:*:*' fzf-preview 'ls --color=always $realpath 2>/dev/null || echo $realpath'
  fi

  export FZF_DEFAULT_OPTS="
    --height 40%
    --layout=reverse
    --border
    --info=inline
    --preview-window=right:50%:wrap
    --bind='ctrl-/:toggle-preview'
  "

  if [ -n "$FZF_FD_CMD" ]; then
    export FZF_DEFAULT_COMMAND="$FZF_FD_CMD --type f --hidden --follow --exclude .git --exclude node_modules"
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
    export FZF_ALT_C_COMMAND="$FZF_FD_CMD --type d --hidden --follow --exclude .git --exclude node_modules"
  fi
fi

unset FZF_FD_CMD FZF_BAT_CMD
