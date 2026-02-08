import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { tripletexEnv } from "./validators";

/** List product mappings for an org and environment. */
export const list = query({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnv,
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("productMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.take(limit);
	},
});

/** Get a specific product mapping by Rubic product code. */
export const getByRubicCode = query({
	args: {
		organizationId: v.id("organizations"),
		rubicProductCode: v.string(),
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("productMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicProductCode", args.rubicProductCode)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();
	},
});

/** Create or update a product mapping. */
export const upsert = mutation({
	args: {
		organizationId: v.id("organizations"),
		rubicProductCode: v.string(),
		tripletexEnv: tripletexEnv,
		tripletexProductId: v.number(),
		hash: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("productMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicProductCode", args.rubicProductCode)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				tripletexProductId: args.tripletexProductId,
				hash: args.hash,
				lastSyncedAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("productMapping", {
			organizationId: args.organizationId,
			rubicProductCode: args.rubicProductCode,
			tripletexEnv: args.tripletexEnv,
			tripletexProductId: args.tripletexProductId,
			lastSyncedAt: Date.now(),
			hash: args.hash,
		});
	},
});
