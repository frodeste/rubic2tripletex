import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { memberRole } from "./validators";

/** List organizations the current user belongs to. */
export const listForUser = query({
	args: { auth0UserId: v.string() },
	handler: async (ctx, args) => {
		const memberships = await ctx.db
			.query("organizationMembers")
			.withIndex("by_user", (q) => q.eq("auth0UserId", args.auth0UserId))
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

/** Get a single organization by ID. */
export const get = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.organizationId);
	},
});

/** Get organization by Auth0 org ID. */
export const getByAuth0OrgId = query({
	args: { auth0OrgId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("organizations")
			.withIndex("by_auth0OrgId", (q) => q.eq("auth0OrgId", args.auth0OrgId))
			.unique();
	},
});

/** Create a new organization. */
export const create = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		auth0OrgId: v.string(),
		creatorAuth0UserId: v.string(),
	},
	handler: async (ctx, args) => {
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
			auth0UserId: args.creatorAuth0UserId,
			role: "admin",
			joinedAt: Date.now(),
		});

		return orgId;
	},
});

/** Update an organization. */
export const update = mutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.optional(v.string()),
		slug: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { organizationId, ...updates } = args;
		const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
		if (Object.keys(filtered).length > 0) {
			await ctx.db.patch(organizationId, filtered);
		}
	},
});

/** List members of an organization. */
export const listMembers = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("organizationMembers")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
	},
});

/** Add a member to an organization. */
export const addMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		auth0UserId: v.string(),
		role: memberRole,
	},
	handler: async (ctx, args) => {
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

/** Remove a member from an organization. */
export const removeMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		auth0UserId: v.string(),
	},
	handler: async (ctx, args) => {
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
