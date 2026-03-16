# Environment and platform detection.
# PATH extensions, editor, telemetry, direnv, WSL/Windows op.

# Path extensions (bootstrap PATH is in .zshrc)
export BUN_INSTALL="$HOME/.bun"
[ -d "$BUN_INSTALL/bin" ] && export PATH="$BUN_INSTALL/bin:$PATH"
[ -d "$HOME/.npm-global/bin" ] && export PATH="$HOME/.npm-global/bin:$PATH"

# FNM: no --use-on-cd. Run `fnm use` or use .nvmrc when needed.
FNM_PATH="$HOME/.local/share/fnm"
if [ -x "$FNM_PATH/fnm" ]; then
  export PATH="$FNM_PATH:$PATH"
  eval "$("$FNM_PATH/fnm" env --shell zsh)"
fi

# WSL: prefer Windows 1Password CLI when available (desktop/SSO integration).
OP_WINDOWS_EXE_GLOBAL="/mnt/c/Program Files/1Password CLI/op.exe"
if [ -x "$OP_WINDOWS_EXE_GLOBAL" ]; then
  op() {
    "$OP_WINDOWS_EXE_GLOBAL" "$@"
  }
elif command -v op.exe >/dev/null 2>&1; then
  alias op='op.exe'
fi

# Editor and telemetry
export EDITOR="code --wait"
export VISUAL="code --wait"
export NEXT_TELEMETRY_DISABLED=1

# direnv
if command -v direnv >/dev/null 2>&1; then
  eval "$(direnv hook zsh)"
fi
