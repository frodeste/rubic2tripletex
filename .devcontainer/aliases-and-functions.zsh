# Aliases and functions for Rubic2Tripletex devcontainer.

# ---- General (use lsd when available) ----
if command -v lsd >/dev/null 2>&1; then
  alias ls='lsd'
  alias ll='lsd -la'
  alias la='lsd -A'
  alias l='lsd -CF'
else
  alias ll='ls -la'
  alias la='ls -A'
  alias l='ls -CF'
fi
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias cls="clear"
alias reload="source ~/.zshrc"

# ---- Bun ----
alias b="bun"
alias bi="bun install"
alias ba="bun add"
alias bd="bun run dev"
alias bb="bun run build"
alias bt="bun test"
alias bx="bunx"

# ---- Drizzle ----
alias dbg="bun run db:generate"
alias dbm="bun run db:migrate"
alias dbs="bun run db:studio"

# ---- Biome ----
alias check="bun run check"
alias lint="bun run lint"
alias fmt="bun run format"

# ---- Git ----
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

# ---- Vercel ----
alias v="vercel"
alias vd="vercel dev"
alias vp="vercel --prod"
alias venv="vercel env pull .env.local"

# ---- 1Password ----
if command -v op &> /dev/null; then
  [ -f "$HOME/.config/op/plugins.sh" ] && source "$HOME/.config/op/plugins.sh"
  alias opl="op signin"
  alias ops="op item list"
  alias opg="op item get"
  opsecret() { op item get "$1" --fields "$2" 2>/dev/null }
  openv() { eval $(op inject -i "$1") }
fi

# ---- Auth0 ----
if command -v auth0 &> /dev/null; then
  alias a0="auth0"
  alias a0l="auth0 login"
  alias a0apps="auth0 apps list"
  alias a0apis="auth0 apis list"
  alias a0logs="auth0 logs tail"
  alias a0test="auth0 test login"
fi

# ---- Utilities ----
mkcd() { mkdir -p "$1" && cd "$1" }
port() { lsof -i ":$1" 2>/dev/null || echo "Port $1 is free" }
killport() {
  local pid=$(lsof -t -i ":$1" 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid && echo "Killed process $pid on port $1"
  else
    echo "No process found on port $1"
  fi
}
json() {
  if [ -t 0 ]; then
    cat "$1" | jq .
  else
    jq .
  fi
}

# ---- Welcome and help ----
if [[ $- == *i* ]] && [ -z "$WELCOMED" ]; then
  export WELCOMED=1
  echo ""
  echo "Rubic2Tripletex Development Container"
  echo "Type 'help-dev' for available commands"
  echo ""
fi

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
