# Rubic2Tripletex Development Container
# Node.js/TypeScript + Bun for Next.js development
# https://github.com/devcontainers/templates

FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# Build arguments for version pinning
ARG BUN_VERSION=1.2.4

# Disable telemetry during build
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=true

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    # PostgreSQL client (for psql, pg_dump against Neon)
    postgresql-client \
    # Build essentials for native modules
    build-essential \
    pkg-config \
    libssl-dev \
    # Useful utilities
    jq \
    httpie \
    fzf \
    fd-find \
    bat \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for fd and bat (Debian uses different names)
RUN ln -sf /usr/bin/fdfind /usr/bin/fd 2>/dev/null || true && \
    ln -sf /usr/bin/batcat /usr/bin/bat 2>/dev/null || true

# Install 1Password CLI
RUN curl -sS https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" > /etc/apt/sources.list.d/1password.list \
    && mkdir -p /etc/debsig/policies/AC2D62742012EA22/ \
    && curl -sS https://downloads.1password.com/linux/debian/debsig/1password.pol > /etc/debsig/policies/AC2D62742012EA22/1password.pol \
    && mkdir -p /usr/share/debsig/keyrings/AC2D62742012EA22 \
    && curl -sS https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/debsig/keyrings/AC2D62742012EA22/debsig.gpg \
    && apt-get update && apt-get install -y 1password-cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Switch to node user for remaining setup
USER node

# Install Bun (pinned version)
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Install global npm tools
RUN npm install -g \
    typescript \
    @biomejs/biome \
    vercel

# Install Zsh plugins (baked into image for faster startup)
ENV ZSH_CUSTOM="/home/node/.oh-my-zsh/custom"
RUN mkdir -p ${ZSH_CUSTOM}/plugins && \
    git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions && \
    git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting && \
    git clone --depth=1 https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM}/plugins/zsh-completions && \
    git clone --depth=1 https://github.com/Aloxaf/fzf-tab ${ZSH_CUSTOM}/plugins/fzf-tab

# Set working directory
WORKDIR /workspaces/rubic2tripletex
