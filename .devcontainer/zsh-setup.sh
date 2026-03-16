#!/bin/bash
# Install Zsh plugins under ~/.local/share/zsh/plugins (no Oh My Zsh).
# Called from post-create.sh.

set -e

PLUGINS_DIR="${HOME}/.local/share/zsh/plugins"
OMZ_URL="https://github.com/ohmyzsh/ohmyzsh.git"
OMZ_PLUGINS="gh sudo extract"

echo "Setting up Zsh plugins in $PLUGINS_DIR..."
mkdir -p "$PLUGINS_DIR"

# Clone once and copy OMZ plugins (gh, sudo, extract) only if any are missing
if [[ -n "$OMZ_PLUGINS" ]]; then
  needs_fetch=false
  for p in $OMZ_PLUGINS; do
    if [ ! -d "$PLUGINS_DIR/$p" ]; then
      needs_fetch=true
      break
    fi
  done

  if [ "$needs_fetch" = true ]; then
    OMZ_TMP=$(mktemp -d)
    echo "  Fetching Oh My Zsh (plugins only)..."
    if git clone --depth 1 "$OMZ_URL" "$OMZ_TMP"; then
      for p in $OMZ_PLUGINS; do
        if [ -d "$OMZ_TMP/plugins/$p" ] && [ ! -d "$PLUGINS_DIR/$p" ]; then
          cp -R "$OMZ_TMP/plugins/$p" "$PLUGINS_DIR/"
          echo "  Installed $p"
        fi
      done
    fi
    rm -rf "$OMZ_TMP"
  fi
fi

# zsh-autosuggestions
if [ ! -d "$PLUGINS_DIR/zsh-autosuggestions" ]; then
  echo "  Installing zsh-autosuggestions..."
  git clone --depth 1 https://github.com/zsh-users/zsh-autosuggestions "$PLUGINS_DIR/zsh-autosuggestions"
fi

# fzf-tab
if [ ! -d "$PLUGINS_DIR/fzf-tab" ]; then
  echo "  Installing fzf-tab..."
  git clone --depth 1 https://github.com/Aloxaf/fzf-tab "$PLUGINS_DIR/fzf-tab"
fi

# zsh-syntax-highlighting (must be loaded last)
if [ ! -d "$PLUGINS_DIR/zsh-syntax-highlighting" ]; then
  echo "  Installing zsh-syntax-highlighting..."
  git clone --depth 1 https://github.com/zsh-users/zsh-syntax-highlighting "$PLUGINS_DIR/zsh-syntax-highlighting"
fi

# 1password: stub so .zshrc can load; op completion comes from op plugin install / ~/.config/op
if [ ! -d "$PLUGINS_DIR/1password" ]; then
  mkdir -p "$PLUGINS_DIR/1password"
  echo '# 1Password: completions via op plugin install; this file satisfies plugin loader.' > "$PLUGINS_DIR/1password/1password.plugin.zsh"
  echo "  Installed 1password (stub)"
fi

echo "Zsh plugins installed successfully."