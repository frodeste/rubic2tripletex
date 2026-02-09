import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { requireOrgAdmin, requireOrgMembership } from "./lib/auth";
import {
	addAuth0OrgMember,
	assignAuth0OrgRoles,
	removeAuth0OrgMember,
} from "./lib/auth0Management";
import type { MemberRole } from "./validators";
import { memberRole } from "./validators";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the Auth0 user ID (subject) from a Convex tokenIdentifier.
 * Format: "https://domain/|auth0|user123" → "auth0|user123"
 */
function extractAuth0UserId(tokenIdentifier: string): string {
	const firstPipe = tokenIdentifier.indexOf("|");
	if (firstPipe === -1) {
		throw new Error(`Invalid tokenIdentifier format: ${tokenIdentifier}`);
	}
	return tokenIdentifier.substring(firstPipe + 1);
}

/**
 * Verify the caller is authenticated and an admin of the organization.
 * Works in action context (no ctx.db) by using ctx.runQuery.
 */
async function requireActionAdmin(
	ctx: Pick<GenericActionCtx<DataModel>, "auth" | "runQuery">,
	organizationId: Id<"organizations">,
) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated: you must be logged in to perform this action.");
	}

	const user = await ctx.runQuery(api.users.current, {});
	if (!user) {
		throw new Error("User record not found. Please reload the page.");
	}

	const membership = await ctx.runQuery(internal.organizations.checkMembership, {
		organizationId,
		userId: user._id,
	});
	if (!membership) {
		throw new Error("Forbidden: you are not a member of this organization.");
	}
	if (membership.role !== "admin" && membership.role !== "owner") {
		throw new Error("Forbidden: you must be an admin of this organization.");
	}

	return { identity, user, membership };
}

/**
 * Sync a membership to Auth0 (best-effort).
 * If the org has an auth0OrgId, adds the user to the Auth0 org
 * and assigns the specified role. Logs and continues on failure.
 */
async function syncMemberToAuth0(
	auth0OrgId: string | undefined,
	auth0UserId: string,
	role: MemberRole,
): Promise<void> {
	if (!auth0OrgId) return;

	try {
		await addAuth0OrgMember(auth0OrgId, auth0UserId);
		await assignAuth0OrgRoles(auth0OrgId, auth0UserId, [role]);
	} catch (error) {
		// Best-effort: log but don't fail the Convex operation
		console.error("Failed to sync member to Auth0:", error);
	}
}

/**
 * Remove a membership from Auth0 (best-effort).
 */
async function removeMemberFromAuth0(
	auth0OrgId: string | undefined,
	auth0UserId: string,
): Promise<void> {
	if (!auth0OrgId) return;

	try {
		await removeAuth0OrgMember(auth0OrgId, auth0UserId);
	} catch (error) {
		console.error("Failed to remove member from Auth0:", error);
	}
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listForUser = authenticatedQuery({
	args: {},
	handler: async (ctx) => {
		const memberships = await ctx.db
			.query("memberships")
			.withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
			.collect();
		const orgs = await Promise.all(
			memberships.map(async (m) => {
				const org = await ctx.db.get(m.organizationId);
				return org ? { ...org, role: m.role } : null;
			}),
		);
		return orgs.filter(Boolean);
	},
});

export const get = authenticatedQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);
		return await ctx.db.get(args.organizationId);
	},
});

export const getByAuth0OrgId = authenticatedQuery({
	args: { auth0OrgId: v.string() },
	handler: async (ctx, args) => {
		const org = await ctx.db
			.query("organizations")
			.withIndex("by_auth0OrgId", (q) => q.eq("auth0OrgId", args.auth0OrgId))
			.unique();
		if (!org) return null;
		const membership = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", org._id).eq("userId", ctx.user._id),
			)
			.unique();
		if (!membership) {
			throw new Error("Forbidden: you are not a member of this organization.");
		}
		return org;
	},
});

export const listMembers = authenticatedQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);
		const memberships = await ctx.db
			.query("memberships")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
		const results = await Promise.all(
			memberships.map(async (m) => {
				const user = await ctx.db.get(m.userId);
				if (!user) {
					return null;
				}
				return {
					...m,
					user: {
						_id: user._id,
						name: user.name,
						email: user.email,
						avatarUrl: user.avatarUrl,
					},
				};
			}),
		);
		return results.filter(Boolean);
	},
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = authenticatedMutation({
	args: {
		name: v.string(),
		slug: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("organizations")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (existing) {
			throw new Error(`Organization with slug "${args.slug}" already exists`);
		}
		const orgId = await ctx.db.insert("organizations", {
			name: args.name,
			slug: args.slug,
			createdAt: Date.now(),
		});
		await ctx.db.insert("memberships", {
			organizationId: orgId,
			userId: ctx.user._id,
			role: "owner",
			joinedAt: Date.now(),
		});
		return orgId;
	},
});

export const update = authenticatedMutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.optional(v.string()),
		slug: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireOrgAdmin(ctx, args.organizationId);
		const { organizationId, ...updates } = args;
		const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
		if (Object.keys(filtered).length > 0) {
			await ctx.db.patch(organizationId, filtered);
		}
	},
});

// ---------------------------------------------------------------------------
// Internal mutations (called by actions after Auth0 sync)
// ---------------------------------------------------------------------------

/** Internal: insert a membership record. No auth check — called by actions. */
export const addMemberData = internalMutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();
		if (existing) {
			throw new Error("User is already a member of this organization");
		}
		return await ctx.db.insert("memberships", {
			organizationId: args.organizationId,
			userId: args.userId,
			role: args.role,
			joinedAt: Date.now(),
		});
	},
});

/** Internal: remove a membership record. No auth check — called by actions. */
export const removeMemberData = internalMutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();
		if (membership) {
			await ctx.db.delete(membership._id);
		}
	},
});

// ---------------------------------------------------------------------------
// Actions (dual-write: Auth0 + Convex)
// ---------------------------------------------------------------------------

/**
 * Add a member to an organization.
 * Syncs to Auth0 (best-effort) then writes to Convex.
 * Requires admin or owner role.
 */
export const addMember = action({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireActionAdmin(ctx, args.organizationId);

		if (args.role === "owner" && callerMembership.role !== "owner") {
			throw new Error("Only owners can add other owners.");
		}

		// Look up the target user and org for Auth0 sync
		const targetUser = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		// Sync to Auth0 (best-effort)
		if (targetUser && org?.auth0OrgId) {
			const auth0UserId = extractAuth0UserId(targetUser.tokenIdentifier);
			await syncMemberToAuth0(org.auth0OrgId, auth0UserId, args.role);
		}

		// Write to Convex
		return await ctx.runMutation(internal.organizations.addMemberData, {
			organizationId: args.organizationId,
			userId: args.userId,
			role: args.role,
		});
	},
});

/**
 * Remove a member from an organization.
 * Syncs to Auth0 (best-effort) then removes from Convex.
 * Requires admin or owner role. Cannot remove the last admin/owner.
 */
export const removeMember = action({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const { user: callerUser } = await requireActionAdmin(ctx, args.organizationId);

		// Prevent removing self if they're the last admin/owner
		if (callerUser._id === args.userId) {
			const members = await ctx.runQuery(internal.organizations.listMembersInternal, {
				organizationId: args.organizationId,
			});
			const admins = members.filter((m) => m.role === "admin" || m.role === "owner");
			if (admins.length <= 1) {
				throw new Error("Cannot remove the last admin or owner of an organization.");
			}
		}

		// Look up the target user and org for Auth0 sync
		const targetUser = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		// Remove from Auth0 (best-effort)
		if (targetUser && org?.auth0OrgId) {
			const auth0UserId = extractAuth0UserId(targetUser.tokenIdentifier);
			await removeMemberFromAuth0(org.auth0OrgId, auth0UserId);
		}

		// Remove from Convex
		await ctx.runMutation(internal.organizations.removeMemberData, {
			organizationId: args.organizationId,
			userId: args.userId,
		});
	},
});

// ---------------------------------------------------------------------------
// Internal queries (used by actions)
// ---------------------------------------------------------------------------

/**
 * Check whether a user is a member of the specified organization.
 * Returns the membership document if found, or null otherwise.
 *
 * This is an internal query used by actions (e.g. sync.ts) that cannot
 * access ctx.db directly and need to verify org membership via ctx.runQuery.
 */
export const checkMembership = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();
	},
});

/** Internal: get a user by ID (for Auth0 sync in actions). */
export const getUserById = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.userId);
	},
});

/** Internal: get an org by ID (for Auth0 sync in actions). */
export const getOrgById = internalQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.organizationId);
	},
});

/** Internal: list all memberships for an org (for admin checks in actions). */
export const listMembersInternal = internalQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("memberships")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
	},
});
