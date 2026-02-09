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

Next.js 16 (App Router) · TypeScript · Node.js 24 · Bun · Convex · Auth0 · Vercel · Sentry · Biome.js

## Quick Start

**Option A — DevContainer (recommended):**

Open in VS Code/Cursor with the Dev Containers extension. The pre-built image from GHCR includes Node 24, Bun, and all tooling -- managed entirely via [devcontainer features](https://containers.dev/features). See [docs/development.md](docs/development.md) for details.

**AI coding tools** (Claude Code, OpenAI Codex) are pre-installed. Set `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as environment variables on your host before opening the container.

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
| `bun run dev` | Start Next.js + Convex dev servers |
| `bun run build` | Production build |
| `bun run check` | Lint + format (Biome) |
| `bun test` | Run tests |
| `npx convex dev` | Start Convex dev server (standalone) |
| `npx convex dashboard` | Open Convex dashboard |

## Auth0 M2M Setup

Convex is the source of truth for organizations, memberships, and roles. Changes are synced to Auth0 via the Management API using a **Machine-to-Machine (M2M) application**. Auth0 Organizations and Roles are auto-created on demand -- no manual setup in the Auth0 Dashboard is required.

### 1. Create an M2M application

1. Go to **Auth0 Dashboard > Applications > Applications > Create Application**
2. Choose **Machine to Machine Applications**
3. Name it something like `Rubic2Tripletex M2M`
4. Authorize it for the **Auth0 Management API** (`https://<your-tenant>.eu.auth0.com/api/v2/`)
5. Grant the following scopes:

| Scope | Purpose |
| --- | --- |
| `update:users` | Sync profile changes (name) |
| `read:roles` | Look up existing Auth0 roles |
| `create:roles` | Auto-create Auth0 roles on demand |
| `create:organizations` | Create Auth0 Organizations from Convex |
| `read:organizations` | Verify Auth0 org state |
| `update:organizations` | Sync org name changes |
| `read:organization_members` | Read org membership |
| `create:organization_members` | Add members to Auth0 orgs |
| `delete:organization_members` | Remove members from Auth0 orgs |
| `read:organization_member_roles` | Read member roles |
| `create:organization_member_roles` | Assign roles to org members |
| `delete:organization_member_roles` | Remove roles from org members |

### 2. Set Convex environment variables

Add the M2M credentials to your Convex deployment:

```bash
npx convex env set AUTH0_M2M_CLIENT_ID  <client-id-from-step-1>
npx convex env set AUTH0_M2M_CLIENT_SECRET <client-secret-from-step-1>
```

`AUTH0_DOMAIN` should already be set (e.g. `https://your-tenant.eu.auth0.com`).

| Variable | Description |
| --- | --- |
| `AUTH0_DOMAIN` | Auth0 tenant URL (already configured for auth) |
| `AUTH0_M2M_CLIENT_ID` | Client ID of the M2M application |
| `AUTH0_M2M_CLIENT_SECRET` | Client secret of the M2M application |

> **Note:** Without these credentials, Convex still works normally as the source of truth. Auth0 sync is silently skipped and a warning is logged to the Convex dashboard.

See [docs/auth0-post-login-action.md](docs/auth0-post-login-action.md) for the complementary Auth0 Post-Login Action setup.

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, database schema
- [Development](docs/development.md) — setup, environment variables, testing, deployment
- [Auth0 Post-Login Action](docs/auth0-post-login-action.md) — provisioning users in Convex on login

## Commit Conventions

Uses [Conventional Commits](https://www.conventionalcommits.org/) with [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning.

| Prefix | Version Bump |
| ----------- | ------------ |
| `feat:` | Minor |
| `fix:` | Patch |
| `feat!:` / `BREAKING CHANGE:` | Major |
| `docs:` / `chore:` / `ci:` / `test:` / `refactor:` | None |
