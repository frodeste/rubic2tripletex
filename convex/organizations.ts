import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { memberRole } from "./validators";
import { requireAuth, requireOrgAdmin, requireOrgMembership } from "./lib/auth";

/** List organizations the authenticated user belongs to. */
export const listForUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await requireAuth(ctx);
		const auth0UserId = identity.subject;

		const memberships = await ctx.db
			.query("organizationMembers")
			.withIndex("by_user", (q) => q.eq("auth0UserId", auth0UserId))
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

/** Get a single organization by ID (requires membership). */
export const get = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);
		return await ctx.db.get(args.organizationId);
	},
});

/** Get organization by Auth0 org ID (requires membership). */
export const getByAuth0OrgId = query({
	args: { auth0OrgId: v.string() },
	handler: async (ctx, args) => {
		const identity = await requireAuth(ctx);
		const org = await ctx.db
			.query("organizations")
			.withIndex("by_auth0OrgId", (q) => q.eq("auth0OrgId", args.auth0OrgId))
			.unique();

		if (!org) return null;

		// Verify the caller is a member
		const auth0UserId = identity.subject;
		const membership = await ctx.db
			.query("organizationMembers")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", org._id).eq("auth0UserId", auth0UserId),
			)
			.unique();

		if (!membership) {
			throw new Error("Forbidden: you are not a member of this organization.");
		}

		return org;
	},
});

/** Create a new organization. The authenticated user becomes the admin. */
export const create = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		auth0OrgId: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await requireAuth(ctx);
		const auth0UserId = identity.subject;

		// Check slug uniqueness
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

		// Add creator as admin
		await ctx.db.insert("organizationMembers", {
			organizationId: orgId,
			auth0UserId,
			role: "admin",
			joinedAt: Date.now(),
		});

		return orgId;
	},
});

/** Update an organization (requires admin). */
export const update = mutation({
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

/** List members of an organization (requires membership). */
export const listMembers = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);
		return await ctx.db
			.query("organizationMembers")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
	},
});

/** Add a member to an organization (requires admin). */
export const addMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		auth0UserId: v.string(),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		await requireOrgAdmin(ctx, args.organizationId);

		// Check if already a member
		const existing = await ctx.db
			.query("organizationMembers")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("auth0UserId", args.auth0UserId),
			)
			.unique();
		if (existing) {
			throw new Error("User is already a member of this organization");
		}

		return await ctx.db.insert("organizationMembers", {
			organizationId: args.organizationId,
			auth0UserId: args.auth0UserId,
			role: args.role,
			joinedAt: Date.now(),
		});
	},
});

/** Remove a member from an organization (requires admin). */
export const removeMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		auth0UserId: v.string(),
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireOrgAdmin(ctx, args.organizationId);

		// Prevent the last admin from removing themselves
		if (callerMembership.auth0UserId === args.auth0UserId) {
			const admins = (
				await ctx.db
					.query("organizationMembers")
					.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
					.collect()
			).filter((m) => m.role === "admin");

			if (admins.length <= 1) {
				throw new Error("Cannot remove the last admin of an organization.");
			}
		}

		const membership = await ctx.db
			.query("organizationMembers")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("auth0UserId", args.auth0UserId),
			)
			.unique();
		if (membership) {
			await ctx.db.delete(membership._id);
		}
	},
});

/**
 * Internal query to check organization membership.
 * Used by action wrappers that cannot access ctx.db directly.
 * Returns the membership record or null.
 */
export const checkMembership = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		auth0UserId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("organizationMembers")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("auth0UserId", args.auth0UserId),
			)
			.unique();
	},
});
