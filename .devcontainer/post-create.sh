#!/bin/bash
# Post-create script for Rubic2Tripletex devcontainer
# This script runs after the container is created

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up Rubic2Tripletex development environment..."

# ==============================================================================
# Git Configuration
# ==============================================================================
echo "Configuring git..."
git config --global --add safe.directory /workspaces/rubic2tripletex
git config --global pull.rebase true
git config --global fetch.prune true
git config --global diff.colorMoved zebra

# ==============================================================================
# lsd (modern ls) — install from GitHub release if not in image
# ==============================================================================
if ! command -v lsd &> /dev/null; then
    echo "Installing lsd..."
    LSD_VER="1.0.0"
    LSD_DEB="lsd_${LSD_VER}_amd64.deb"
    if curl -sSL -o /tmp/"$LSD_DEB" "https://github.com/lsd-rs/lsd/releases/download/v${LSD_VER}/${LSD_DEB}" && sudo dpkg -i /tmp/"$LSD_DEB"; then
        echo "  lsd installed"
    fi
    rm -f /tmp/"$LSD_DEB"
fi

# ==============================================================================
# Zsh: plugins under ~/.local/share/zsh/plugins (no Oh My Zsh)
# ==============================================================================
echo "Setting up Zsh plugins..."
if ! bash "$SCRIPT_DIR/zsh-setup.sh"; then
    echo "[post-create] Warning: Failed to set up zsh plugins." >&2
    echo "[post-create] Zsh plugins are optional — continuing with the rest of setup." >&2
fi

# ==============================================================================
# Starship prompt
# ==============================================================================
if ! command -v starship &> /dev/null; then
    echo "Installing Starship..."
    curl -sS https://starship.rs/install.sh | sh -s -- -y
fi

# ==============================================================================
# Zsh and shell config (layered: .zshrc + ~/.config/shell/* + ~/.local/share/zsh/*)
# ==============================================================================
echo "Deploying Zsh and Starship config..."
mkdir -p "$HOME/.config/shell"
mkdir -p "$HOME/.local/share/zsh"

cp "$SCRIPT_DIR/.zshrc" "$HOME/.zshrc"
[ -f "$SCRIPT_DIR/env.zsh" ] && cp "$SCRIPT_DIR/env.zsh" "$HOME/.config/shell/env.zsh"
[ -f "$SCRIPT_DIR/history-and-completion.zsh" ] && cp "$SCRIPT_DIR/history-and-completion.zsh" "$HOME/.config/shell/history-and-completion.zsh"
[ -f "$SCRIPT_DIR/aliases-and-functions.zsh" ] && cp "$SCRIPT_DIR/aliases-and-functions.zsh" "$HOME/.config/shell/aliases-and-functions.zsh"
[ -f "$SCRIPT_DIR/key-bindings.zsh" ] && cp "$SCRIPT_DIR/key-bindings.zsh" "$HOME/.local/share/zsh/key-bindings.zsh"
mkdir -p "$HOME/.config"
[ -f "$SCRIPT_DIR/starship.toml" ] && cp "$SCRIPT_DIR/starship.toml" "$HOME/.config/starship.toml"

echo "  Zsh and Starship config deployed"

# ==============================================================================
# Dependencies Installation
# ==============================================================================
echo "Installing dependencies with bun..."
bun install

# ==============================================================================
# Environment Files
# ==============================================================================
echo "Setting up environment files..."

if [ -f ".env.example" ] && [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo "  Created .env.local from .env.example"
    echo "  IMPORTANT: Run 'vercel env pull .env.local' or edit .env.local with your credentials"
else
    echo "  .env.local already exists"
fi

# ==============================================================================
# 1Password Setup (if available)
# ==============================================================================
if command -v op &> /dev/null; then
    echo ""
    echo "1Password CLI detected!"
    echo "  Run 'op signin' to authenticate"
    mkdir -p "$HOME/.config/op"
fi

# ==============================================================================
# Auth0 CLI Setup
# ==============================================================================
echo "Installing Auth0 CLI..."
mkdir -p "$HOME/.local/bin"
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b "$HOME/.local/bin"

# ==============================================================================
# Sentry CLI Setup
# ==============================================================================
echo "Installing Sentry CLI..."
if command -v sentry-cli &> /dev/null; then
    echo "  Sentry CLI already installed"
else
    if curl -sL https://sentry.io/get-cli/ | sh; then
        echo "  Sentry CLI installed"
    else
        echo "[post-create] Warning: Failed to install Sentry CLI." >&2
        echo "[post-create] Continuing setup. You can retry later with: curl -sL https://sentry.io/get-cli/ | sh" >&2
    fi
fi

# ==============================================================================
# MCP Servers Setup (for Cursor AI)
# ==============================================================================
MCP_TEMPLATE="$SCRIPT_DIR/mcp.json.template"
MCP_TARGET=".cursor/mcp.json"

if [ -f "$MCP_TEMPLATE" ]; then
    mkdir -p .cursor
    if [ ! -f "$MCP_TARGET" ]; then
        cp "$MCP_TEMPLATE" "$MCP_TARGET"
        echo "  Created $MCP_TARGET from template"
        echo "  MCP servers configured: Figma, Context7, GitHub, Sentry"
    else
        echo "  MCP config already exists at $MCP_TARGET"
    fi
fi

# ==============================================================================
# Tool Verification
# ==============================================================================
echo ""
echo "Verifying installations..."
echo "  Node.js:      $(node --version)"
echo "  Bun:          $(bun --version 2>/dev/null || echo 'not installed')"
echo "  TypeScript:   $(tsc --version 2>/dev/null || echo 'not installed')"
echo "  Vercel:       $(vercel --version 2>/dev/null || echo 'not installed')"
echo "  gh CLI:       $(gh --version 2>/dev/null | head -1 || echo 'not installed')"
echo "  1Password:    $(op --version 2>/dev/null || echo 'not installed')"
echo "  fzf:          $(fzf --version 2>/dev/null || echo 'not installed')"
echo "  ripgrep:      $(rg --version 2>/dev/null | head -1 || echo 'not installed')"
echo "  lsd:          $(lsd --version 2>/dev/null | head -1 || echo 'not installed')"
echo "  starship:     $(starship --version 2>/dev/null || echo 'not installed')"
echo "  psql:         $(psql --version 2>/dev/null | head -1 || echo 'not installed')"
echo "  Claude Code:  $(claude --version 2>/dev/null || echo 'not installed')"
echo "  Codex:        $(codex --version 2>/dev/null || echo 'not installed')"
echo "  Auth0 CLI:    $(auth0 --version 2>/dev/null || echo 'not installed')"
echo "  Sentry CLI:   $(sentry-cli --version 2>/dev/null || echo 'not installed')"

# ==============================================================================
# Completion Message
# ==============================================================================
echo ""
echo "=============================================================================="
echo "Development environment setup complete!"
echo "=============================================================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. ENVIRONMENT VARIABLES"
echo "   Edit .env.local with your secrets (see .env.example)"
echo "   Or run: vercel env pull .env.local"
echo ""
echo "2. DATABASE"
echo "   This project uses Neon (Vercel Postgres) for both dev and production."
echo "   Ensure DATABASE_URL is set in .env.local"
echo "   Run migrations: bun run db:migrate"
echo ""
echo "3. AUTHENTICATION"
echo "   gh auth login          # GitHub CLI"
echo "   op signin              # 1Password"
echo "   vercel login           # Vercel"
echo "   auth0 login            # Auth0 CLI"
echo ""
echo "4. START DEVELOPMENT"
echo "   bun run dev            # Start Next.js dev server"
echo "   bun run db:studio      # Open Drizzle Studio"
echo ""
echo "Type 'help-dev' for a list of useful aliases and commands"
echo "=============================================================================="
