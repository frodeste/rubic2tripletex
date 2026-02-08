---
name: convex-migration
description: Guide migration from the current Drizzle ORM / Neon Postgres stack to Convex. Use when the user asks about Convex, migrating the database, replacing Drizzle, or setting up Convex schema, functions, or queries. Provides schema translation, function patterns, and migration considerations specific to this project.
---

# Convex Migration Guide

This project currently uses **Drizzle ORM + Neon Postgres**. This skill guides migration to **Convex** as the backend database.

## Current Stack (What We're Migrating From)

- **ORM:** Drizzle ORM 0.45.x with `drizzle-kit` for migrations
- **Database:** Neon Postgres (serverless)
- **Schema:** `src/db/schema.ts` -- 4 tables with enums, composite primary keys
- **Client:** `src/db/client.ts` -- Drizzle client with Neon connection
- **Migrations:** `src/db/migrations/` -- SQL migration files

### Current Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `sync_state` | Tracks each sync run | serial PK, sync_type enum, status enum, timestamps |
| `customer_mapping` | Rubic customerNo -> Tripletex customerId | composite PK (rubic_id, env), hash |
| `product_mapping` | Rubic productCode -> Tripletex productId | composite PK (rubic_id, env), hash |
| `invoice_mapping` | Rubic invoiceId -> Tripletex invoiceId | composite PK (rubic_id, env), payment_synced |

### Current Enums

- `sync_type`: `"customers" | "products" | "invoices" | "payments"`
- `sync_status`: `"running" | "success" | "failed"`
- `tripletex_env`: `"sandbox" | "production"`

## Convex Equivalents

### Schema Translation

The current Drizzle schema in `src/db/schema.ts` maps to Convex like this:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const syncType = v.union(
	v.literal("customers"),
	v.literal("products"),
	v.literal("invoices"),
	v.literal("payments"),
);

const syncStatus = v.union(
	v.literal("running"),
	v.literal("success"),
	v.literal("failed"),
);

const tripletexEnv = v.union(
	v.literal("sandbox"),
	v.literal("production"),
);

export default defineSchema({
	syncState: defineTable({
		syncType: syncType,
		tripletexEnv: tripletexEnv,
		lastSyncAt: v.optional(v.number()), // epoch ms
		status: syncStatus,
		errorMessage: v.optional(v.string()),
		recordsProcessed: v.number(),
		recordsFailed: v.number(),
		startedAt: v.number(), // epoch ms
		completedAt: v.optional(v.number()),
	})
		.index("by_type_and_env", ["syncType", "tripletexEnv"])
		.index("by_status", ["status"]),

	customerMapping: defineTable({
		rubicCustomerNo: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexCustomerId: v.number(),
		lastSyncedAt: v.number(),
		hash: v.optional(v.string()),
	})
		.index("by_rubic_and_env", ["rubicCustomerNo", "tripletexEnv"]),

	productMapping: defineTable({
		rubicProductCode: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexProductId: v.number(),
		lastSyncedAt: v.number(),
		hash: v.optional(v.string()),
	})
		.index("by_rubic_and_env", ["rubicProductCode", "tripletexEnv"]),

	invoiceMapping: defineTable({
		rubicInvoiceId: v.number(),
		tripletexEnv: tripletexEnv,
		rubicInvoiceNumber: v.number(),
		tripletexInvoiceId: v.number(),
		lastSyncedAt: v.number(),
		paymentSynced: v.boolean(),
	})
		.index("by_rubic_and_env", ["rubicInvoiceId", "tripletexEnv"]),
});
```

### Key Translation Rules

| Drizzle / Postgres | Convex |
|--------------------|--------|
| `serial("id").primaryKey()` | Auto-generated `_id` (no serial IDs) |
| `pgEnum("name", [...])` | `v.union(v.literal("a"), v.literal("b"))` |
| Composite primary key | `.index("name", ["field1", "field2"])` + unique enforcement in mutations |
| `timestamp({ withTimezone: true })` | `v.number()` (epoch ms via `Date.now()`) |
| `varchar("col", { length: N })` | `v.string()` (no length limits in Convex) |
| `integer("col")` | `v.number()` |
| `boolean("col")` | `v.boolean()` |
| `text("col")` | `v.string()` |
| `.notNull()` | Field is required by default |
| `.default(value)` | Set in mutation handler, not in schema |
| `NULL` / nullable | `v.optional(v.string())` |

### Function Patterns

Convex replaces raw SQL / Drizzle queries with typed functions.

**Query (read data):**

```typescript
// convex/syncState.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLatest = query({
	args: { syncType: v.string(), tripletexEnv: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("syncState")
			.withIndex("by_type_and_env", (q) =>
				q.eq("syncType", args.syncType).eq("tripletexEnv", args.tripletexEnv),
			)
			.order("desc")
			.first();
	},
});
```

**Mutation (write data):**

```typescript
// convex/syncState.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const startSync = mutation({
	args: { syncType: v.string(), tripletexEnv: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.insert("syncState", {
			syncType: args.syncType,
			tripletexEnv: args.tripletexEnv,
			status: "running",
			recordsProcessed: 0,
			recordsFailed: 0,
			startedAt: Date.now(),
		});
	},
});
```

**Action (external API calls):**

Sync logic that calls Rubic/Tripletex APIs should use actions, since they can call external services:

```typescript
// convex/sync.ts
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const syncCustomers = action({
	args: { tripletexEnv: v.string() },
	handler: async (ctx, args) => {
		// Call external APIs
		const customers = await fetchFromRubic();

		// Write to Convex DB via mutations
		for (const customer of customers) {
			await ctx.runMutation(api.customerMapping.upsert, {
				rubicCustomerNo: customer.customerNo,
				tripletexEnv: args.tripletexEnv,
				// ...
			});
		}
	},
});
```

### Next.js Integration

```typescript
// In Server Components or Route Handlers
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Read
const state = await fetchQuery(api.syncState.getLatest, {
	syncType: "customers",
	tripletexEnv: "production",
});

// Write
await fetchMutation(api.syncState.startSync, {
	syncType: "customers",
	tripletexEnv: "production",
});
```

Requires `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_URL` environment variables.

## Migration Steps

1. **Install Convex:** `bun add convex` and `npx convex dev` to initialize
2. **Create schema:** `convex/schema.ts` (see translation above)
3. **Create functions:** `convex/*.ts` for queries, mutations, actions
4. **Migrate data:** Write a one-time script to read from Neon and insert into Convex
5. **Update API routes:** Replace Drizzle queries with Convex function calls
6. **Update sync logic:** Move `src/sync/` orchestration to Convex actions
7. **Remove Drizzle:** Remove `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, and `src/db/`

## Key Differences to Keep in Mind

- **No raw SQL** -- all data access is through Convex functions
- **No migrations** -- schema changes are applied automatically by `npx convex dev` / `npx convex deploy`
- **No connection pooling** -- Convex handles connections internally
- **Composite uniqueness** -- enforce in mutation handlers (query by index, check existence), not at schema level
- **Timestamps** -- use `Date.now()` (epoch ms) instead of SQL `TIMESTAMP WITH TIME ZONE`
- **Realtime by default** -- Convex queries are reactive; the dashboard would get live sync status updates for free

## Reference

- [Convex Docs](https://docs.convex.dev/)
- [Convex Schema Docs](https://docs.convex.dev/database/schemas)
- [Convex Next.js Guide](https://docs.convex.dev/client/nextjs/app-router/)
- [Convex Functions](https://docs.convex.dev/functions)
