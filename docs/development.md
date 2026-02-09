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
| Biome, Vercel CLI | Linting/formatting, deployment |
| fzf, fd, bat, jq, httpie | Shell utilities |

### Getting started

1. Open in VS Code/Cursor with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Click **Reopen in Container** (or run the command from the palette)
3. The post-create script runs `bun install` and copies `.env.example` → `.env.local` if missing
4. Fill in `.env.local` with your credentials (see [Environment Variables](#environment-variables))

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
bun run dev                    # http://localhost:3000
```

In a separate terminal, start the Convex dev server:

```bash
bun run dev:convex             # watches convex/ and auto-deploys
```

Requires [Node.js 24+](https://nodejs.org/) and [Bun](https://bun.sh).

## Environment Variables

All variables are documented in `.env.example`. Key groups:

| Group | Variables |
| --- | --- |
| Convex | `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY` |
| Auth0 | `AUTH0_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `APP_BASE_URL`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID` |
| Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |

> **Note:** Rubic and Tripletex API credentials are managed per-organization in the app's Settings page and stored in Convex — they are not environment variables.

### Convex Environment Variables

Some variables must be set in the **Convex Dashboard** (Settings → Environment Variables), not in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `AUTH0_ACTION_SECRET` | Shared secret for the Auth0 Post-Login Action HTTP endpoint |
| `AUTH0_DOMAIN` | Auth0 tenant URL (e.g. `https://your-tenant.eu.auth0.com`) |
| `AUTH0_M2M_CLIENT_ID` | M2M application Client ID for Auth0 Management API |
| `AUTH0_M2M_CLIENT_SECRET` | M2M application Client Secret |

The M2M credentials enable Convex to auto-create Auth0 Organizations and Roles, and sync membership/role changes. Without them, Convex operates standalone (Auth0 sync is silently skipped).

See [Auth0 Post-Login Action Guide](./auth0-post-login-action.md) and the [README Auth0 M2M Setup](../README.md#auth0-m2m-setup) for details.

## Convex Development

### Schema changes

Edit `convex/schema.ts`, then the dev server (`bun run dev:convex`) auto-deploys. For production, use:

```bash
bunx convex deploy
```

### Adding functions

Convex functions live in `convex/*.ts`. Use the authenticated builders for any function that accesses user data:

```typescript
import { authenticatedQuery, authenticatedMutation } from "./functions";

export const myQuery = authenticatedQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    // ctx.user and ctx.identity are always available
    const { membership } = await requireOrgMembership(ctx, args.orgId);
    // ... your logic
  },
});
```

### Convex Dashboard

```bash
bunx convex dashboard    # opens the Convex dashboard in your browser
```

Use the dashboard to:
- Browse and edit data
- View function logs
- Monitor HTTP Actions
- Manage environment variables

## Auth0 Setup

### Prerequisites

1. An Auth0 tenant with a **Regular Web Application** configured
2. An **API** in Auth0 with identifier matching your Convex deployment URL
3. Callback URLs configured for `http://localhost:3000` (dev) and your production domain

### Convex Auth Config

Auth0 is configured as an identity provider in `convex/auth.config.ts`. Convex verifies JWTs against the configured Auth0 domain, making `ctx.auth.getUserIdentity()` available in all functions.

### Post-Login Action

For server-side user provisioning, set up the Auth0 Post-Login Action. See the full guide: [Auth0 Post-Login Action](./auth0-post-login-action.md).

## Testing

Tests use [Bun's built-in test runner](https://bun.sh/docs/cli/test):

```bash
bun test                              # run all tests
bun test --coverage                   # with coverage
bun test src/mappers/invoice.mapper.test.ts   # specific file
```

## Linting, Formatting, and Type Checking

Uses [Biome.js](https://biomejs.dev/) (tabs, double quotes, 100 char width):

```bash
bun run check      # lint + format (auto-fix)
bun run lint       # lint only
bun run format     # format only
bun run typecheck  # tsc --noEmit
```

### Pre-commit checklist

Before committing, ensure all three pass:

```bash
bun run check && bun run typecheck
```

## Deployment

### Convex

```bash
bunx convex deploy    # deploy schema + functions to production
```

### Next.js (Vercel)

Deployments are automatic via Vercel's GitHub integration. Ensure environment variables are set in the Vercel dashboard.

### CI Pipeline

The GitHub Actions CI workflow (`.github/workflows/ci.yml`) runs:
1. `bun install`
2. `bun run lint` (Biome)
3. `bun run typecheck` (TypeScript)
4. `bun test` (unit tests)
