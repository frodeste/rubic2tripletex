import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { ensureAuth0RoleIds } from "./auth0RoleMappings";
import { extractAuth0UserId, requireOrgAdmin, requireOrgMembership } from "./lib/auth";
import {
	addAuth0OrgMember,
	assignAuth0OrgRoles,
	createAuth0Organization,
	removeAuth0OrgMember,
	removeAuth0OrgRoles,
	updateAuth0Organization,
} from "./lib/auth0Management";
import { memberRole } from "./validators";

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

export const update = authenticatedMutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.optional(v.string()),
		slug: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireOrgAdmin(ctx, args.organizationId);
		const org = await ctx.db.get(args.organizationId);

		const { organizationId, ...updates } = args;
		const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
		if (Object.keys(filtered).length > 0) {
			await ctx.db.patch(organizationId, filtered);
		}

		// Schedule Auth0 org name sync (best-effort) if name changed
		if (args.name && org?.auth0OrgId) {
			await ctx.scheduler.runAfter(0, internal.organizations.syncOrgUpdateToAuth0, {
				auth0OrgId: org.auth0OrgId,
				displayName: args.name,
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Internal mutations (called by actions after Auth0 sync)
// ---------------------------------------------------------------------------

/** Internal: create an organization + owner membership. No auth check. */
export const createOrgData = internalMutation({
	args: {
		name: v.string(),
		slug: v.string(),
		auth0OrgId: v.optional(v.string()),
		ownerUserId: v.id("users"),
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
			auth0OrgId: args.auth0OrgId,
			createdAt: Date.now(),
		});
		await ctx.db.insert("memberships", {
			organizationId: orgId,
			userId: args.ownerUserId,
			role: "owner",
			joinedAt: Date.now(),
		});
		return orgId;
	},
});

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

/** Internal: update a membership role. No auth check — called by actions. */
export const updateMemberRoleData = internalMutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		newRole: memberRole,
	},
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("memberships")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();
		if (!membership) {
			throw new Error("Membership not found");
		}
		await ctx.db.patch(membership._id, { role: args.newRole });
	},
});

// ---------------------------------------------------------------------------
// Actions (Convex-first with Auth0 sync)
// ---------------------------------------------------------------------------

/**
 * Create an organization.
 * Creates in Auth0 (best-effort), then writes to Convex.
 * The creating user becomes the owner.
 */
export const create = action({
	args: {
		name: v.string(),
		slug: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated: you must be logged in to perform this action.");
		}
		const user = await ctx.runQuery(api.users.current, {});
		if (!user) {
			throw new Error("User record not found. Please reload the page.");
		}

		// 1. Create Auth0 organization (best-effort)
		let auth0OrgId: string | undefined;
		try {
			auth0OrgId = await createAuth0Organization(args.slug, args.name);
		} catch (error) {
			console.error("Failed to create Auth0 organization (continuing without):", error);
		}

		// 2. Create org + owner membership in Convex
		const orgId = await ctx.runMutation(internal.organizations.createOrgData, {
			name: args.name,
			slug: args.slug,
			auth0OrgId,
			ownerUserId: user._id,
		});

		// 3. Sync owner membership to Auth0 (best-effort)
		if (auth0OrgId) {
			try {
				const auth0UserId = extractAuth0UserId(user.tokenIdentifier);
				await addAuth0OrgMember(auth0OrgId, auth0UserId);
				const [ownerRoleId] = await ensureAuth0RoleIds(ctx, ["owner"]);
				await assignAuth0OrgRoles(auth0OrgId, auth0UserId, [ownerRoleId]);
			} catch (error) {
				console.error("Failed to sync owner to Auth0 org:", error);
			}
		}

		return orgId;
	},
});

/**
 * Add a member to an organization.
 * Writes to Convex first, then syncs to Auth0 (best-effort).
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

		// Write to Convex first (source of truth)
		const membershipId = await ctx.runMutation(internal.organizations.addMemberData, {
			organizationId: args.organizationId,
			userId: args.userId,
			role: args.role,
		});

		// Sync to Auth0 (best-effort)
		const targetUser = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (targetUser && org?.auth0OrgId) {
			try {
				const auth0UserId = extractAuth0UserId(targetUser.tokenIdentifier);
				await addAuth0OrgMember(org.auth0OrgId, auth0UserId);
				const roleIds = await ensureAuth0RoleIds(ctx, [args.role]);
				await assignAuth0OrgRoles(org.auth0OrgId, auth0UserId, roleIds);
			} catch (error) {
				console.error("Failed to sync member to Auth0:", error);
			}
		}

		return membershipId;
	},
});

/**
 * Remove a member from an organization.
 * Removes from Convex first, then syncs to Auth0 (best-effort).
 * Requires admin or owner role. Cannot remove the last admin/owner.
 */
export const removeMember = action({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const { user: callerUser, membership: callerMembership } = await requireActionAdmin(
			ctx,
			args.organizationId,
		);

		// Fetch the target user's membership to enforce privilege hierarchy
		const targetMembership = await ctx.runQuery(internal.organizations.checkMembership, {
			organizationId: args.organizationId,
			userId: args.userId,
		});
		if (!targetMembership) {
			throw new Error("Target user is not a member of this organization.");
		}

		// Only owners can remove other owners
		if (targetMembership.role === "owner" && callerMembership.role !== "owner") {
			throw new Error("Only owners can remove other owners.");
		}

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

		// Remove from Convex first (source of truth)
		await ctx.runMutation(internal.organizations.removeMemberData, {
			organizationId: args.organizationId,
			userId: args.userId,
		});

		// Remove from Auth0 (best-effort)
		const targetUser = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (targetUser && org?.auth0OrgId) {
			try {
				const auth0UserId = extractAuth0UserId(targetUser.tokenIdentifier);
				await removeAuth0OrgMember(org.auth0OrgId, auth0UserId);
			} catch (error) {
				console.error("Failed to remove member from Auth0:", error);
			}
		}
	},
});

/**
 * Change a member's role in an organization.
 * Updates Convex first, then syncs the role change to Auth0 (best-effort).
 * Requires admin or owner role. Only owners can promote/demote to/from owner.
 */
export const changeMemberRole = action({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		newRole: memberRole,
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireActionAdmin(ctx, args.organizationId);

		// Fetch the target user's current membership
		const targetMembership = await ctx.runQuery(internal.organizations.checkMembership, {
			organizationId: args.organizationId,
			userId: args.userId,
		});
		if (!targetMembership) {
			throw new Error("Target user is not a member of this organization.");
		}

		const oldRole = targetMembership.role;

		if (oldRole === args.newRole) {
			return; // No change needed
		}

		// Privilege hierarchy: only owners can change to/from owner
		if ((oldRole === "owner" || args.newRole === "owner") && callerMembership.role !== "owner") {
			throw new Error("Only owners can promote or demote owners.");
		}

		// Update Convex first (source of truth)
		await ctx.runMutation(internal.organizations.updateMemberRoleData, {
			organizationId: args.organizationId,
			userId: args.userId,
			newRole: args.newRole,
		});

		// Sync role change to Auth0 (best-effort)
		const targetUser = await ctx.runQuery(internal.organizations.getUserById, {
			userId: args.userId,
		});
		const org = await ctx.runQuery(internal.organizations.getOrgById, {
			organizationId: args.organizationId,
		});

		if (targetUser && org?.auth0OrgId) {
			try {
				const auth0UserId = extractAuth0UserId(targetUser.tokenIdentifier);
				const [oldRoleId, newRoleId] = await ensureAuth0RoleIds(ctx, [oldRole, args.newRole]);
				await removeAuth0OrgRoles(org.auth0OrgId, auth0UserId, [oldRoleId]);
				await assignAuth0OrgRoles(org.auth0OrgId, auth0UserId, [newRoleId]);
			} catch (error) {
				console.error("Failed to sync role change to Auth0:", error);
			}
		}
	},
});

// ---------------------------------------------------------------------------
// Internal actions (Auth0 sync)
// ---------------------------------------------------------------------------

/** Sync an organization name change to Auth0 (best-effort). */
export const syncOrgUpdateToAuth0 = internalAction({
	args: {
		auth0OrgId: v.string(),
		displayName: v.string(),
	},
	handler: async (_ctx, args) => {
		try {
			await updateAuth0Organization(args.auth0OrgId, {
				display_name: args.displayName,
			});
		} catch (error) {
			console.error("Failed to sync org update to Auth0:", error);
		}
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
