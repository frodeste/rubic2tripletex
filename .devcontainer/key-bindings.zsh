# Emacs-style key bindings (standalone, no Oh My Zsh).
# See: zsh Line Editor docs (Zle Builtins, Standard Widgets).

if (( ${+terminfo[smkx]} )) && (( ${+terminfo[rmkx]} )); then
  function zle-line-init() { echoti smkx }
  function zle-line-finish() { echoti rmkx }
  zle -N zle-line-init
  zle -N zle-line-finish
fi

bindkey -e

# [PageUp] / [PageDown] - history
[[ -n "${terminfo[kpp]}" ]] && bindkey -M emacs "${terminfo[kpp]}" up-line-or-history
[[ -n "${terminfo[kpp]}" ]] && bindkey -M viins "${terminfo[kpp]}" up-line-or-history
[[ -n "${terminfo[kpp]}" ]] && bindkey -M vicmd "${terminfo[kpp]}" up-line-or-history
[[ -n "${terminfo[knp]}" ]] && bindkey -M emacs "${terminfo[knp]}" down-line-or-history
[[ -n "${terminfo[knp]}" ]] && bindkey -M viins "${terminfo[knp]}" down-line-or-history
[[ -n "${terminfo[knp]}" ]] && bindkey -M vicmd "${terminfo[knp]}" down-line-or-history

# [Up]/[Down] - history search from beginning of line
autoload -U up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
bindkey -M emacs "^[[A" up-line-or-beginning-search
bindkey -M viins "^[[A" up-line-or-beginning-search
bindkey -M vicmd "^[[A" up-line-or-beginning-search
bindkey -M emacs "^[[B" down-line-or-beginning-search
bindkey -M viins "^[[B" down-line-or-beginning-search
bindkey -M vicmd "^[[B" down-line-or-beginning-search
[[ -n "${terminfo[kcuu1]}" ]] && bindkey -M emacs "${terminfo[kcuu1]}" up-line-or-beginning-search
[[ -n "${terminfo[kcuu1]}" ]] && bindkey -M viins "${terminfo[kcuu1]}" up-line-or-beginning-search
[[ -n "${terminfo[kcuu1]}" ]] && bindkey -M vicmd "${terminfo[kcuu1]}" up-line-or-beginning-search
[[ -n "${terminfo[kcud1]}" ]] && bindkey -M emacs "${terminfo[kcud1]}" down-line-or-beginning-search
[[ -n "${terminfo[kcud1]}" ]] && bindkey -M viins "${terminfo[kcud1]}" down-line-or-beginning-search
[[ -n "${terminfo[kcud1]}" ]] && bindkey -M vicmd "${terminfo[kcud1]}" down-line-or-beginning-search

# [Home] / [End]
[[ -n "${terminfo[khome]}" ]] && bindkey -M emacs "${terminfo[khome]}" beginning-of-line
[[ -n "${terminfo[khome]}" ]] && bindkey -M viins "${terminfo[khome]}" beginning-of-line
[[ -n "${terminfo[khome]}" ]] && bindkey -M vicmd "${terminfo[khome]}" beginning-of-line
[[ -n "${terminfo[kend]}" ]] && bindkey -M emacs "${terminfo[kend]}" end-of-line
[[ -n "${terminfo[kend]}" ]] && bindkey -M viins "${terminfo[kend]}" end-of-line
[[ -n "${terminfo[kend]}" ]] && bindkey -M vicmd "${terminfo[kend]}" end-of-line

# [Shift-Tab] - reverse menu complete
[[ -n "${terminfo[kcbt]}" ]] && bindkey -M emacs "${terminfo[kcbt]}" reverse-menu-complete
[[ -n "${terminfo[kcbt]}" ]] && bindkey -M viins "${terminfo[kcbt]}" reverse-menu-complete
[[ -n "${terminfo[kcbt]}" ]] && bindkey -M vicmd "${terminfo[kcbt]}" reverse-menu-complete

# [Backspace] / [Delete]
bindkey -M emacs '^?' backward-delete-char
bindkey -M viins '^?' backward-delete-char
bindkey -M vicmd '^?' backward-delete-char
if [[ -n "${terminfo[kdch1]}" ]]; then
  bindkey -M emacs "${terminfo[kdch1]}" delete-char
  bindkey -M viins "${terminfo[kdch1]}" delete-char
  bindkey -M vicmd "${terminfo[kdch1]}" delete-char
else
  bindkey -M emacs "^[[3~" delete-char
  bindkey -M viins "^[[3~" delete-char
  bindkey -M vicmd "^[[3~" delete-char
  bindkey -M emacs "^[3;5~" delete-char
  bindkey -M viins "^[3;5~" delete-char
  bindkey -M vicmd "^[3;5~" delete-char
fi

# [Ctrl-Delete] - kill word
bindkey -M emacs '^[[3;5~' kill-word
bindkey -M viins '^[[3;5~' kill-word
bindkey -M vicmd '^[[3;5~' kill-word

# [Ctrl-Left/Right] - word movement
bindkey -M emacs '^[[1;5C' forward-word
bindkey -M viins '^[[1;5C' forward-word
bindkey -M vicmd '^[[1;5C' forward-word
bindkey -M emacs '^[[1;5D' backward-word
bindkey -M viins '^[[1;5D' backward-word
bindkey -M vicmd '^[[1;5D' backward-word

# [Esc-w] kill region, [Esc-l] run ls, [Space] magic-space
# Ctrl-R: left to fzf (when loaded) for history; otherwise zsh default applies
bindkey '\ew' kill-region
bindkey -s '\el' '^q ls\n'
bindkey ' ' magic-space

# [Ctrl-x Ctrl-e] edit command line
autoload -U edit-command-line
zle -N edit-command-line
bindkey '\C-x\C-e' edit-command-line

bindkey "^[m" copy-prev-shell-word
