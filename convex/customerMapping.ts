import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List customer mappings for an org and environment (requires membership). */
export const list = query({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnv,
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const limit = args.limit ?? 100;
		return await ctx.db
			.query("customerMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.take(limit);
	},
});

/** List customer mappings — internal only (used by sync actions). */
export const listInternal = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnv,
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("customerMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.take(limit);
	},
});

/** Get a specific customer mapping by Rubic customer number — internal only. */
export const getByRubicNo = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		rubicCustomerNo: v.string(),
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("customerMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicCustomerNo", args.rubicCustomerNo)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();
	},
});

/** Create or update a customer mapping — internal only (used by sync). */
export const upsert = internalMutation({
	args: {
		organizationId: v.id("organizations"),
		rubicCustomerNo: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexCustomerId: v.number(),
		hash: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("customerMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicCustomerNo", args.rubicCustomerNo)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				tripletexCustomerId: args.tripletexCustomerId,
				hash: args.hash,
				lastSyncedAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("customerMapping", {
			organizationId: args.organizationId,
			rubicCustomerNo: args.rubicCustomerNo,
			tripletexEnv: args.tripletexEnv,
			tripletexCustomerId: args.tripletexCustomerId,
			lastSyncedAt: Date.now(),
			hash: args.hash,
		});
	},
});
