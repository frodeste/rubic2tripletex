#!/bin/bash
# Install Zsh plugins under ~/.local/share/zsh/plugins (no Oh My Zsh).
# Called from post-create.sh.

set -e

PLUGINS_DIR="${HOME}/.local/share/zsh/plugins"
OMZ_URL="https://github.com/ohmyzsh/ohmyzsh.git"
OMZ_PLUGINS="gh sudo extract"

echo "Setting up Zsh plugins in $PLUGINS_DIR..."
mkdir -p "$PLUGINS_DIR"

# Clone once and copy OMZ plugins (gh, sudo, extract)
if [[ -n "$OMZ_PLUGINS" ]]; then
  OMZ_TMP="$PLUGINS_DIR/.omz_tmp"
  if [ ! -d "$OMZ_TMP/plugins/gh" ]; then
    echo "  Fetching Oh My Zsh (plugins only)..."
    git clone --depth 1 "$OMZ_URL" "$OMZ_TMP"
    for p in $OMZ_PLUGINS; do
      if [ -d "$OMZ_TMP/plugins/$p" ]; then
        cp -R "$OMZ_TMP/plugins/$p" "$PLUGINS_DIR/"
        echo "  Installed $p"
      fi
    done
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