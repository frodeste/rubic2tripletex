# Development Guide

## DevContainer (Recommended)

The project uses a DevContainer built entirely from [devcontainer features](https://containers.dev/features) on top of the `typescript-node:24-bookworm` base image. A pre-built image is pushed to GHCR by the `devcontainers/ci` GitHub Action for faster startup.

Included tools (all managed as features, auto-updated by Dependabot):

| Tool | Purpose |
| --- | --- |
| Node.js 24, TypeScript | Runtime and type checking |
| Bun | Package manager and test runner |
| Claude Code, OpenAI Codex | AI coding assistants |
| GitHub CLI, 1Password CLI | Authentication |
| PostgreSQL client (psql) | Database access (Neon) |
| Biome, Vercel CLI | Linting/formatting, deployment |
| fzf, fd, bat, jq, httpie | Shell utilities |

### Getting started

1. Open in VS Code/Cursor with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Click **Reopen in Container** (or run the command from the palette)
3. The post-create script runs `bun install` and copies `.env.example` → `.env.local` if missing
4. Fill in `.env.local` with your credentials (or run `vercel env pull .env.local`)

Port **3000** (Next.js) is forwarded automatically.

## AI Coding Tools

Claude Code and OpenAI Codex are pre-installed via devcontainer features. To use them, set the required API keys as environment variables **on your host machine** before opening the container:

```bash
# Add to your shell profile (~/.zshrc, ~/.bashrc, etc.)
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

These are forwarded into the container via `remoteEnv` in `devcontainer.json`.

### Quick start

```bash
claude          # Start Claude Code interactive session
codex           # Start OpenAI Codex interactive session
```

Both tools have full access to the workspace and can read/edit files, run commands, and interact with git.

## Manual Setup

```bash
bun install
cp .env.example .env.local    # fill in credentials
bun run db:migrate
bun run dev                    # http://localhost:3000
```

Requires [Node.js 24+](https://nodejs.org/) and [Bun](https://bun.sh).

## Environment Variables

All variables are documented in `.env.example`. Key groups:

| Group | Variables |
| --------- | --------- |
| Database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| Rubic | `RUBIC_API_BASE_URL`, `RUBIC_API_KEY`, `RUBIC_ORGANIZATION_ID` |
| Tripletex (prod) | `TRIPLETEX_PROD_ENABLED`, `TRIPLETEX_PROD_BASE_URL`, `TRIPLETEX_PROD_CONSUMER_TOKEN`, `TRIPLETEX_PROD_EMPLOYEE_TOKEN` |
| Tripletex (sandbox) | `TRIPLETEX_SANDBOX_ENABLED`, `TRIPLETEX_SANDBOX_BASE_URL`, `TRIPLETEX_SANDBOX_CONSUMER_TOKEN`, `TRIPLETEX_SANDBOX_EMPLOYEE_TOKEN` |
| Auth0 | `AUTH0_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `APP_BASE_URL` |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| Cron | `CRON_SECRET` |

## Testing

Tests use [Bun's built-in test runner](https://bun.sh/docs/cli/test):

```bash
bun test                              # run all tests
bun test --coverage                   # with coverage
bun test src/sync/customers.test.ts   # specific file
```

## Database Migrations

Uses [Drizzle ORM](https://orm.drizzle.team/) with Neon Postgres:

```bash
bun run db:generate   # generate migration from schema changes
bun run db:migrate    # apply pending migrations
bun run db:studio     # open DB browser
```

**Workflow:** Edit `src/db/schema.ts` → `bun run db:generate` → review migration in `src/db/migrations/` → `bun run db:migrate`.

Migrations use `DATABASE_URL_UNPOOLED` because the pooler doesn't support DDL.

## Linting and Formatting

Uses [Biome.js](https://biomejs.dev/) (tabs, double quotes, 100 char width):

```bash
bun run check    # lint + format (auto-fix)
bun run lint     # lint only
bun run format   # format only
```
