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
# Zsh Plugins (fallback if devcontainer feature didn't install them)
# ==============================================================================
echo "Checking zsh plugins..."
if ! bash "$SCRIPT_DIR/zsh-setup.sh"; then
    echo "[post-create] Warning: Failed to set up zsh plugins." >&2
    echo "[post-create] Zsh plugins are optional — continuing with the rest of setup." >&2
fi

# ==============================================================================
# Zsh Configuration
# ==============================================================================
CUSTOM_ZSHRC="$SCRIPT_DIR/.zshrc"
USER_ZSHRC="$HOME/.zshrc"

if [ -f "$CUSTOM_ZSHRC" ]; then
    if ! grep -q "Rubic2Tripletex Development Container" "$USER_ZSHRC" 2>/dev/null; then
        echo "" >> "$USER_ZSHRC"
        echo "# Load Rubic2Tripletex custom configuration" >> "$USER_ZSHRC"
        echo "source \"$CUSTOM_ZSHRC\"" >> "$USER_ZSHRC"
        echo "  Custom zsh configuration linked"
    else
        echo "  Custom zsh configuration already linked"
    fi
fi

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
echo "  psql:         $(psql --version 2>/dev/null | head -1 || echo 'not installed')"
echo "  Terraform:    $(terraform version 2>/dev/null | grep '^Terraform v' || echo 'not installed')"
echo "  Claude Code:  $(claude --version 2>/dev/null || echo 'not installed')"
echo "  Codex:        $(codex --version 2>/dev/null || echo 'not installed')"
echo "  Auth0 CLI:    $(auth0 --version 2>/dev/null || echo 'not installed')"

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
