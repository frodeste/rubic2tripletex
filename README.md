# Rubic2Tripletex

One-way data sync from [Rubic](https://rubic.no) (membership management) to [Tripletex](https://tripletex.no) (ERP), hosted on Vercel.

| Sync Type | Schedule | Change Detection |
| --------- | -------- | ---------------- |
| Customers | Every 6h | SHA-256 hash |
| Products | Every 6h | SHA-256 hash |
| Invoices | Every 2h | Mapping existence |
| Payments | Every 1h | `paymentSynced` flag |

Both **sandbox** and **production** Tripletex environments are supported with independent credentials and enable/disable controls.

## Tech Stack

Next.js 16 (App Router) · TypeScript · Node.js 24 · Bun · Vercel · Neon Postgres · Drizzle ORM · Auth0 · Sentry · Biome.js

## Quick Start

**Option A — DevContainer (recommended):**

Open in VS Code/Cursor with the Dev Containers extension. The pre-built image from GHCR includes Node 24, Bun, and all tooling. See [docs/development.md](docs/development.md) for details.

**Option B — Manual:**

```bash
bun install
cp .env.example .env.local   # fill in credentials
bun run db:migrate
bun run dev                   # http://localhost:3000
```

## Scripts

| Command | Description |
| ------------------- | -------------------------------- |
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run check` | Lint + format (Biome) |
| `bun test` | Run tests |
| `bun run db:generate` | Generate Drizzle migration |
| `bun run db:migrate` | Apply migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, database schema, API routes
- [Development](docs/development.md) — setup, environment variables, testing, migrations

## Commit Conventions

Uses [Conventional Commits](https://www.conventionalcommits.org/) with [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning.

| Prefix | Version Bump |
| ----------- | ------------ |
| `feat:` | Minor |
| `fix:` | Patch |
| `feat!:` / `BREAKING CHANGE:` | Major |
| `docs:` / `chore:` / `ci:` / `test:` / `refactor:` | None |
