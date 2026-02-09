# Auth0 Post-Login Action: Convex User Provisioning

## Overview

This guide explains how to set up an Auth0 **Post-Login Action** that ensures every authenticated user has a corresponding record in the Convex `users` table. This is the server-side complement to the client-side JIT provisioning already implemented in `OrganizationProvider` via the `useStoreUserEffect` hook.

### Why both client-side and server-side provisioning?

| Approach | Purpose |
| --- | --- |
| **Client-side** (`useStoreUserEffect`) | Handles the common case: user logs in via the browser, React calls `api.users.store` immediately. Already implemented. |
| **Post-Login Action** (this guide) | Catches edge cases: API-only access, mobile clients, or scenarios where the React app hasn't loaded yet. Also attaches custom claims to the ID token. |

Together, they guarantee that by the time any Convex function runs, the `users` record exists.

## Architecture

```
User logs in
    │
    ▼
Auth0 Authentication
    │
    ▼
Post-Login Action fires
    │
    ├─► Call Convex HTTP Action: upsertUser(tokenIdentifier, email, name, avatarUrl)
    │       └─► Convex creates or updates the `users` record
    │
    └─► (Optional) Set custom claims on the ID token
            └─► e.g. active_org_id, roles
    │
    ▼
ID token returned to client
    │
    ▼
ConvexProviderWithAuth receives token
    │
    ▼
useStoreUserEffect runs (idempotent — no-ops if record already exists)
```

## Prerequisites

1. **Auth0 tenant** with an application configured for this project
2. **Convex deployment** with the schema deployed (the `users` table must exist)
3. **Convex HTTP Action** endpoint to receive the upsert call (we'll create this)
4. **Auth0 Dashboard** access to create Actions

## Step 1: Create the Convex HTTP Action

The Post-Login Action needs a server-to-server endpoint. Convex HTTP Actions serve this purpose. Create the file `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * HTTP endpoint for Auth0 Post-Login Action to upsert a user record.
 * Auth0 calls this endpoint after every successful login.
 *
 * Expected JSON body:
 *   { tokenIdentifier: string, email: string, name?: string, avatarUrl?: string }
 *
 * Protected by a shared secret in the Authorization header.
 */
http.route({
  path: "/auth0/upsert-user",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify shared secret
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.AUTH0_ACTION_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { tokenIdentifier, email, name, avatarUrl } = body;

    if (!tokenIdentifier || !email) {
      return new Response("Missing required fields: tokenIdentifier, email", {
        status: 400,
      });
    }

    // Call an internal mutation to upsert the user
    const userId = await ctx.runMutation(internal.users.upsertFromAuth0, {
      tokenIdentifier,
      email,
      name: name ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    });

    return new Response(JSON.stringify({ userId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

## Step 2: Create the Internal Mutation

Add the `upsertFromAuth0` internal mutation to `convex/users.ts`:

```typescript
import { internalMutation } from "./_generated/server";

/**
 * Internal mutation called by the Auth0 Post-Login HTTP Action.
 * Upserts a user record by tokenIdentifier. Not exposed to the client.
 */
export const upsertFromAuth0 = internalMutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier)
      )
      .unique();

    const now = Date.now();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        lastActiveAt: now,
        ...(args.name && args.name !== existingUser.name
          ? { name: args.name }
          : {}),
        ...(args.avatarUrl && args.avatarUrl !== existingUser.avatarUrl
          ? { avatarUrl: args.avatarUrl }
          : {}),
      });
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: args.tokenIdentifier,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      lastActiveAt: now,
      createdAt: now,
    });
  },
});
```

## Step 3: Set the Shared Secret

Generate a strong secret and configure it in both Convex and Auth0:

```bash
# Generate a 32-byte hex secret
openssl rand -hex 32
```

**In the Convex Dashboard:**

1. Go to your deployment → Settings → Environment Variables
2. Add: `AUTH0_ACTION_SECRET` = `<your-generated-secret>`

**In Auth0** (done in Step 4 below as an Action Secret).

## Step 4: Create the Auth0 Post-Login Action

1. Go to **Auth0 Dashboard** → **Actions** → **Library** → **Build Custom**
2. Name: `Convex User Provisioning`
3. Trigger: `post-login`
4. Runtime: Node.js 22

### Action Secrets

In the Action's sidebar, add these secrets:

| Key | Value |
| --- | --- |
| `CONVEX_HTTP_URL` | Your Convex HTTP Actions URL (e.g. `https://friendly-finch-466.eu-west-1.convex.site`) |
| `AUTH0_ACTION_SECRET` | The same secret from Step 3 |
| `AUTH0_DOMAIN` | Your Auth0 tenant domain (e.g. `uniteperformance.eu.auth0.com`) |
| `MGMT_CLIENT_ID` | M2M application client ID (for fetching org roles) |
| `MGMT_CLIENT_SECRET` | M2M application client secret |

> **Note:** The HTTP Actions URL ends in `.convex.site` (not `.convex.cloud`). Find it in the Convex Dashboard → Deployment → HTTP Actions.
>
> The M2M secrets are the same ones used in Convex environment variables (`AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`). They enable the Action to read the user's organization roles and inject them as custom claims in the ID token.

### Action Code

```javascript
const fetch = require("node-fetch");

/**
 * Auth0 Post-Login Action: Upsert user record in Convex.
 *
 * Runs after every successful authentication. Ensures the Convex `users`
 * table has a record for this user before the client app loads.
 *
 * The tokenIdentifier format matches what Convex generates from the JWT:
 *   `https://<auth0-domain>|<auth0-user-id>`
 */
exports.onExecutePostLogin = async (event, api) => {
  const CONVEX_HTTP_URL = event.secrets.CONVEX_HTTP_URL;
  const AUTH0_ACTION_SECRET = event.secrets.AUTH0_ACTION_SECRET;

  // Build the tokenIdentifier that Convex uses internally.
  // Format: "https://<issuer-domain>|<subject>"
  // This must match identity.tokenIdentifier in Convex.
  const issuer = event.tenant.id
    ? `https://${event.request.hostname}/`
    : event.secrets.AUTH0_ISSUER_URL;
  const tokenIdentifier = `${issuer}|${event.user.user_id}`;

  const body = {
    tokenIdentifier,
    email: event.user.email,
    name: event.user.name || event.user.nickname || undefined,
    avatarUrl: event.user.picture || undefined,
  };

  try {
    const response = await fetch(
      `${CONVEX_HTTP_URL}/auth0/upsert-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH0_ACTION_SECRET}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error(
        `Convex upsert failed: ${response.status} ${await response.text()}`
      );
      // Don't block login on failure — client-side JIT is the fallback
    }
  } catch (error) {
    console.error("Convex upsert error:", error.message);
    // Don't block login — fail open, client-side handles it
  }

  // Set organization roles as custom claims on the ID token (Auth0 RBAC).
  // This enables the client to read the user's role without a Convex query,
  // and supports future JWT-based role checks in Convex.
  if (event.organization) {
    const namespace = "https://rubic2tripletex.app";
    api.idToken.setCustomClaim(`${namespace}/org_id`, event.organization.id);
    api.idToken.setCustomClaim(
      `${namespace}/org_name`,
      event.organization.display_name
    );

    // Fetch org roles via Management API (requires M2M secrets below)
    try {
      const mgmtResponse = await fetch(
        `https://${event.secrets.AUTH0_DOMAIN}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: event.secrets.MGMT_CLIENT_ID,
            client_secret: event.secrets.MGMT_CLIENT_SECRET,
            audience: `https://${event.secrets.AUTH0_DOMAIN}/api/v2/`,
          }),
        }
      );
      const { access_token } = await mgmtResponse.json();

      const rolesResponse = await fetch(
        `https://${event.secrets.AUTH0_DOMAIN}/api/v2/organizations/${event.organization.id}/members/${event.user.user_id}/roles`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const roles = await rolesResponse.json();
      const roleNames = roles.map((r) => r.name);

      api.idToken.setCustomClaim(`${namespace}/roles`, roleNames);
    } catch (err) {
      console.error("Failed to fetch org roles:", err.message);
      // Don't block login — roles will be read from Convex membership cache
    }
  }
};
```

### Critical: `tokenIdentifier` Format

The `tokenIdentifier` must match exactly what Convex computes from the JWT's `iss` (issuer) and `sub` (subject) claims. The format is:

```
https://<auth0-domain>/|<auth0-user-id>
```

For example: `https://uniteperformance.eu.auth0.com/|auth0|abc123def456`

This is what `ctx.auth.getUserIdentity().tokenIdentifier` returns in Convex functions, and it's the key used in the `users` table's `by_token` index.

> **Tip:** If you're unsure of the exact format, temporarily log `identity.tokenIdentifier` in the `users.store` mutation and check the Convex dashboard logs.

## Step 5: Deploy the Action

1. Click **Deploy** in the Auth0 Action editor
2. Go to **Actions** → **Flows** → **Login**
3. Drag `Convex User Provisioning` into the flow (after the default Auth0 actions)
4. Click **Apply**

## Step 6: Deploy the Convex HTTP Action

```bash
# Deploy to your Convex project
bunx convex deploy
```

Or, if you're running the dev server:

```bash
# The dev server auto-deploys on file changes
bunx convex dev
```

Verify the HTTP endpoint is active in the Convex Dashboard → HTTP Actions. You should see the `/auth0/upsert-user` route listed.

## Testing

### 1. Test the HTTP endpoint directly

```bash
curl -X POST https://your-project.convex.site/auth0/upsert-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-secret>" \
  -d '{
    "tokenIdentifier": "https://your-tenant.auth0.com/|auth0|test123",
    "email": "test@example.com",
    "name": "Test User"
  }'
```

Expected response: `{"userId": "k57..."}` (a Convex document ID).

### 2. Test the full login flow

1. Open the app and log in
2. Check the Auth0 Dashboard → **Monitoring** → **Logs** for the Post-Login Action execution
3. Check the Convex Dashboard → **Data** → `users` table for the new/updated record
4. Verify the `tokenIdentifier` in Convex matches the format above

### 3. Verify idempotency

Log in multiple times. The `users` table should show:
- Only **one** record per user (no duplicates)
- `lastActiveAt` updated on each login
- `name` / `avatarUrl` updated if changed in Auth0

## Error Handling Strategy

The Action is designed to **fail open** — if the Convex call fails, the login still succeeds:

1. **Post-Login Action fails** → Auth0 logs the error, login continues, client-side `useStoreUserEffect` creates the record on first page load
2. **Convex is down** → Same as above — the client will retry on next page load
3. **Secret mismatch** → HTTP 401 logged in Auth0 and Convex, login continues

This two-layer approach (server-side Action + client-side hook) ensures resilience. The client-side `useStoreUserEffect` in `OrganizationProvider` is always the safety net.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| 401 from Convex HTTP endpoint | Secret mismatch | Verify `AUTH0_ACTION_SECRET` matches in both Convex env vars and Auth0 Action secrets |
| User record not created | `tokenIdentifier` format mismatch | Log both the Action's computed value and Convex's `identity.tokenIdentifier` — they must match exactly |
| Action not running | Not added to Login flow | Auth0 Dashboard → Actions → Flows → Login — verify the action is in the flow |
| Duplicate user records | Different `tokenIdentifier` from Action vs client | Ensure the Action builds the identifier the same way Convex parses the JWT |
| Timeout in Action | Convex HTTP endpoint slow or unreachable | Check Convex deployment status; ensure `.convex.site` URL is correct (not `.convex.cloud`) |

## Source of Truth Boundaries

This Action respects the project's SoT model:

- **Auth0 owns**: authentication credentials, SSO/MFA config, authentication tokens, **organization role assignments (RBAC)**
- **Convex owns**: user application records, organizations, invitations, preferences, all business data
- **Memberships**: Dual-write — Auth0 Organization membership is canonical; Convex `memberships` table is a synced cache for fast queries
- **The Action syncs identity facts** (email, name, avatar) from Auth0 to Convex and **injects organization roles** as custom claims in the ID token

The `users.upsertFromAuth0` mutation only updates `lastActiveAt`, `name`, and `avatarUrl`. Role assignments are managed via Auth0 Organization Roles and synced to Convex when members are added/removed through the application UI (see `convex/organizations.ts` and `convex/invitations.ts`).
