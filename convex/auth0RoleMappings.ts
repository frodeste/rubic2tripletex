/**
 * Auth0 role mapping helpers.
 *
 * Persistently caches the mapping from Convex role names (e.g. "owner")
 * to Auth0 role IDs (e.g. "rol_abc123") in the `auth0RoleMappings` table.
 *
 * The `ensureAuth0RoleIds` utility function is the primary entry point:
 * it reads cached mappings, fetches from Auth0 for any misses, auto-creates
 * roles in Auth0 that don't exist yet, and writes new mappings back to Convex.
 */

import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { createAuth0Role, listAuth0Roles } from "./lib/auth0Management";
import type { MemberRole } from "./validators";

// ---------------------------------------------------------------------------
// Internal query / mutation for the auth0RoleMappings table
// ---------------------------------------------------------------------------

/** Read all cached role mappings. Returns an array of { roleName, auth0RoleId }. */
export const getRoleMappings = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("auth0RoleMappings").collect();
	},
});

/** Insert or update a single role mapping. */
export const upsertRoleMapping = internalMutation({
	args: {
		roleName: v.string(),
		auth0RoleId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("auth0RoleMappings")
			.withIndex("by_roleName", (q) => q.eq("roleName", args.roleName))
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, { auth0RoleId: args.auth0RoleId });
		} else {
			await ctx.db.insert("auth0RoleMappings", {
				roleName: args.roleName,
				auth0RoleId: args.auth0RoleId,
				createdAt: Date.now(),
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Utility: resolve role names → Auth0 role IDs (auto-create if needed)
// ---------------------------------------------------------------------------

/**
 * Resolve Convex role names to Auth0 role IDs, auto-creating any
 * Auth0 roles that don't exist yet.
 *
 * Flow:
 * 1. Read cached mappings from the `auth0RoleMappings` Convex table
 * 2. For any missing roles, fetch the full role list from Auth0
 * 3. For roles found in Auth0 but not cached, store the mapping
 * 4. For roles not found in Auth0 at all, create them via M2M and store
 * 5. Return Auth0 role IDs in the same order as the input role names
 *
 * Must be called from an action context (needs `runQuery` / `runMutation`
 * for Convex table access, and runs HTTP calls to Auth0).
 */
export async function ensureAuth0RoleIds(
	ctx: Pick<GenericActionCtx<DataModel>, "runQuery" | "runMutation">,
	roleNames: MemberRole[],
): Promise<string[]> {
	// 1. Read cached mappings
	const cached = await ctx.runQuery(internal.auth0RoleMappings.getRoleMappings, {});
	const cacheMap = new Map<string, string>(
		cached.map((r: { roleName: string; auth0RoleId: string }) => [r.roleName, r.auth0RoleId]),
	);

	// 2. Identify which roles are missing from the cache
	const uniqueNames = [...new Set(roleNames)];
	const missing = uniqueNames.filter((name) => !cacheMap.has(name));

	if (missing.length > 0) {
		// 3. Fetch all roles from Auth0
		const auth0Roles = await listAuth0Roles();
		const auth0Map = new Map(auth0Roles.map((r) => [r.name, r.id]));

		for (const roleName of missing) {
			let auth0RoleId = auth0Map.get(roleName);

			if (!auth0RoleId) {
				// 4. Role doesn't exist in Auth0 — create it
				auth0RoleId = await createAuth0Role(roleName);
			}

			// 5. Store in Convex cache
			await ctx.runMutation(internal.auth0RoleMappings.upsertRoleMapping, {
				roleName,
				auth0RoleId,
			});
			cacheMap.set(roleName, auth0RoleId);
		}
	}

	// Return IDs in the same order as input
	return roleNames.map((name) => {
		const id = cacheMap.get(name);
		if (!id) {
			throw new Error(`Failed to resolve Auth0 role ID for "${name}"`);
		}
		return id;
	});
}
