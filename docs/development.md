# Development Guide

## Prerequisites

- [Node.js 24+](https://nodejs.org/)
- [Bun](https://bun.sh) (package manager and test runner)
- [Docker](https://www.docker.com/) (for DevContainer)
- Access to Rubic API credentials
- Access to Tripletex API credentials
- Auth0 tenant configured

## DevContainer Setup (Recommended)

The project includes a DevContainer configuration that provides Node.js 24, Bun, and a local PostgreSQL 16 instance.

1. Install [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the project folder in VS Code
3. When prompted, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette)
4. The container will build and run `bun install` automatically
5. The local PostgreSQL database is pre-configured via environment variables

The DevContainer forwards ports:
- **3000** - Next.js dev server
- **5432** - PostgreSQL database

## Manual Setup

If not using DevContainer:

```bash
# Clone the repository
git clone https://github.com/frodeste/rubic2tripletex.git
cd rubic2tripletex

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials
```

## Environment Variables

All required environment variables are documented in `.env.example`. Key groups:

| Variable Group | Variables | Description |
| -------------- | --------- | ----------- |
| Database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon Postgres connection strings |
| Rubic API | `RUBIC_API_BASE_URL`, `RUBIC_API_KEY`, `RUBIC_ORGANIZATION_ID` | Rubic API access |
| Tripletex API | `TRIPLETEX_API_BASE_URL`, `TRIPLETEX_CONSUMER_TOKEN`, `TRIPLETEX_EMPLOYEE_TOKEN` | Tripletex API access |
| Auth0 | `AUTH0_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `APP_BASE_URL` | Dashboard authentication |
| Cron | `CRON_SECRET` | Vercel cron endpoint protection |

**Note**: The DevContainer pre-configures `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to point at the local PostgreSQL instance.

## Running the Application

```bash
# Start the development server
bun run dev

# Production build
bun run build

# Start the production server
bun run start
```

The development server runs at `http://localhost:3000`.

## Running Tests

Tests use [Bun's built-in test runner](https://bun.sh/docs/cli/test) with the `bun:test` module.

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run a specific test file
bun test src/sync/customers.test.ts
```

## Database Migrations

The project uses [Drizzle ORM](https://orm.drizzle.team/) with [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) for schema management and migrations.

```bash
# Generate a new migration from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Open Drizzle Studio (database browser)
bun run db:studio
```

**Workflow for schema changes:**
1. Edit `src/db/schema.ts`
2. Run `bun run db:generate` to create a migration SQL file
3. Review the generated migration in `src/db/migrations/`
4. Run `bun run db:migrate` to apply it

**Note**: Migrations use `DATABASE_URL_UNPOOLED` because pgbouncer (used for pooling) does not support DDL statements.

## Linting and Formatting

The project uses [Biome.js](https://biomejs.dev/) for both linting and formatting.

```bash
# Check and auto-fix everything (lint + format)
bun run check

# Lint only (no auto-fix)
bun run lint

# Format only
bun run format
```

Biome is configured with:
- Tab indentation
- Double quotes
- 100 character line width
- Import organization on save (via VS Code extension)

## Project Layout

```
app/                    # Next.js App Router (UI + API routes)
src/
  clients/              # API clients (Rubic, Tripletex)
  sync/                 # Sync orchestration logic
  mappers/              # Entity mapping functions
  db/                   # Database schema, client, migrations
  types/                # TypeScript type definitions
  config.ts             # Zod-validated environment config
  logger.ts             # Structured JSON logger
docs/                   # Project documentation
```
