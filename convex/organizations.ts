import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { requireOrgAdmin, requireOrgMembership } from "./lib/auth";
import { memberRole } from "./validators";

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

export const addMember = authenticatedMutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: memberRole,
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireOrgAdmin(ctx, args.organizationId);

		if (args.role === "owner" && callerMembership.role !== "owner") {
			throw new Error("Only owners can add other owners.");
		}

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

export const removeMember = authenticatedMutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const { membership: callerMembership } = await requireOrgAdmin(ctx, args.organizationId);
		if (callerMembership.userId === args.userId) {
			const admins = (
				await ctx.db
					.query("memberships")
					.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
					.collect()
			).filter((m) => m.role === "admin" || m.role === "owner");
			if (admins.length <= 1) {
				throw new Error("Cannot remove the last admin or owner of an organization.");
			}
		}
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
