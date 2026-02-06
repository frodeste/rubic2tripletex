FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install PostgreSQL client (for psql, pg_dump, etc.)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Install Bun for the non-root user (devcontainer uses 'node' user)
USER node
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/home/node/.bun"
ENV PATH="/home/node/.bun/bin:$PATH"
