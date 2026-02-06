FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install PostgreSQL client (for psql, pg_dump, etc.)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
