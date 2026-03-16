# Zsh does the real work; Starship does the dashboard.
# Plugins live under ~/.local/share/zsh/plugins (no Oh My Zsh).

# Interactive shells only.
[[ $- != *i* ]] && return

# --- PATH setup ---
[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
[ -d /snap/bin ] && export PATH="/snap/bin:$PATH"

# --- Environment layer first ---
# Needed before plugins so wrappers like `op` exist when plugin checks run.
[ -r "$HOME/.config/shell/env.zsh" ] && source "$HOME/.config/shell/env.zsh"

# --- Completion and cache (for gh/1password) ---
export ZSH_CACHE_DIR="${ZSH_CACHE_DIR:-$HOME/.cache/zsh}"
[ -d "$ZSH_CACHE_DIR/completions" ] || mkdir -p "$ZSH_CACHE_DIR/completions"
fpath=("$HOME/.zsh-complete" "$ZSH_CACHE_DIR/completions" $fpath)
autoload -Uz compinit
if [[ ! -f "$ZSH_CACHE_DIR/.zcompdump" || "$HOME/.zshrc" -nt "$ZSH_CACHE_DIR/.zcompdump" ]]; then
  compinit -d "$ZSH_CACHE_DIR/.zcompdump"
else
  compinit -C -d "$ZSH_CACHE_DIR/.zcompdump"
fi

# --- Key bindings (emacs-style, before plugins so fzf can override e.g. ^R) ---
[ -r "$HOME/.local/share/zsh/key-bindings.zsh" ] && source "$HOME/.local/share/zsh/key-bindings.zsh"

# --- Plugins ---
plugins=(
  gh
  sudo
  extract
  1password
  fzf
  fzf-tab
  zsh-autosuggestions
)

ZSH_PLUGINS_DIR="${ZSH_PLUGINS_DIR:-$HOME/.local/share/zsh/plugins}"

for _p in $plugins; do
  case $_p in
    fzf)
      for _fzf_base in /usr/share/fzf "$HOME/.fzf/shell" "/opt/homebrew/opt/fzf/shell" "/usr/local/opt/fzf/shell"; do
        if [ -d "$_fzf_base" ]; then
          [ -r "$_fzf_base/key-bindings.zsh" ] && source "$_fzf_base/key-bindings.zsh"
          [ -r "$_fzf_base/completion.zsh" ] && source "$_fzf_base/completion.zsh"
          break
        fi
      done
      ;;
    fzf-tab)
      [[ -t 0 && -t 1 ]] && command -v fzf >/dev/null 2>&1 && [ -r "$ZSH_PLUGINS_DIR/fzf-tab/fzf-tab.plugin.zsh" ] && source "$ZSH_PLUGINS_DIR/fzf-tab/fzf-tab.plugin.zsh"
      ;;
    1password)
      command -v op >/dev/null 2>&1 && [ -r "$ZSH_PLUGINS_DIR/1password/1password.plugin.zsh" ] && {
        fpath=("$ZSH_PLUGINS_DIR/1password" $fpath)
        source "$ZSH_PLUGINS_DIR/1password/1password.plugin.zsh"
      }
      ;;
    zsh-autosuggestions)
      ZSH_AUTOSUGGEST_STRATEGY=(history completion)
      ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
      ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#666666"
      [ -r "$ZSH_PLUGINS_DIR/zsh-autosuggestions/zsh-autosuggestions.zsh" ] && source "$ZSH_PLUGINS_DIR/zsh-autosuggestions/zsh-autosuggestions.zsh"
      ;;
    *)
      [ -r "$ZSH_PLUGINS_DIR/$_p/$_p.plugin.zsh" ] && source "$ZSH_PLUGINS_DIR/$_p/$_p.plugin.zsh"
      ;;
  esac
done
unset _p _fzf_base

# --- Config layers (history/completion → aliases/functions) ---
[ -r "$HOME/.config/shell/history-and-completion.zsh" ] && source "$HOME/.config/shell/history-and-completion.zsh"
[ -r "$HOME/.config/shell/aliases-and-functions.zsh" ] && source "$HOME/.config/shell/aliases-and-functions.zsh"

# zsh-syntax-highlighting must be loaded last (after all other plugins)
[ -r "$ZSH_PLUGINS_DIR/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ] && source "$ZSH_PLUGINS_DIR/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"

# Optional machine-local overrides.
[ -r "$HOME/.zshrc.local" ] && source "$HOME/.zshrc.local"

# --- Starship: dashboard prompt ---
command -v starship >/dev/null 2>&1 && eval "$(starship init zsh)"
