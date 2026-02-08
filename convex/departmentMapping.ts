import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List department mappings for an org and environment (requires membership). */
export const list = query({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: v.optional(tripletexEnv),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		if (args.tripletexEnv) {
			return await ctx.db
				.query("departmentMapping")
				.withIndex("by_org_and_env", (q) =>
					q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv!),
				)
				.collect();
		}
		return await ctx.db
			.query("departmentMapping")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
	},
});

/** Create or update a department mapping (requires membership). */
export const upsert = mutation({
	args: {
		organizationId: v.id("organizations"),
		rubicDepartmentId: v.number(),
		rubicDepartmentName: v.string(),
		tripletexDepartmentId: v.number(),
		tripletexDepartmentName: v.string(),
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const existing = await ctx.db
			.query("departmentMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicDepartmentId", args.rubicDepartmentId)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				rubicDepartmentName: args.rubicDepartmentName,
				tripletexDepartmentId: args.tripletexDepartmentId,
				tripletexDepartmentName: args.tripletexDepartmentName,
			});
			return existing._id;
		}

		return await ctx.db.insert("departmentMapping", {
			organizationId: args.organizationId,
			rubicDepartmentId: args.rubicDepartmentId,
			rubicDepartmentName: args.rubicDepartmentName,
			tripletexDepartmentId: args.tripletexDepartmentId,
			tripletexDepartmentName: args.tripletexDepartmentName,
			tripletexEnv: args.tripletexEnv,
		});
	},
});

/** Remove a department mapping (requires membership). */
export const remove = mutation({
	args: { departmentMappingId: v.id("departmentMapping") },
	handler: async (ctx, args) => {
		const mapping = await ctx.db.get(args.departmentMappingId);
		if (!mapping) throw new Error("Department mapping not found");
		await requireOrgMembership(ctx, mapping.organizationId);

		await ctx.db.delete(args.departmentMappingId);
	},
});
