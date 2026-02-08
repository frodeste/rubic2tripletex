import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { syncType, tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List recent sync runs for an organization (requires membership). */
export const list = query({
	args: {
		organizationId: v.id("organizations"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const limit = args.limit ?? 50;
		return await ctx.db
			.query("syncState")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.order("desc")
			.take(limit);
	},
});

/** Get the latest sync run for a specific type and environment (requires membership). */
export const getLatest = query({
	args: {
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		return await ctx.db
			.query("syncState")
			.withIndex("by_org_type_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("syncType", args.syncType)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.order("desc")
			.first();
	},
});

/** Get currently running syncs for an org (requires membership). */
export const getRunning = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const all = await ctx.db
			.query("syncState")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
		return all.filter((s) => s.status === "running");
	},
});

/** Get the latest sync run — internal only (used by sync actions). */
export const getLatestInternal = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("syncState")
			.withIndex("by_org_type_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("syncType", args.syncType)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.order("desc")
			.first();
	},
});

/** Start a new sync run — internal only (used by sync actions). */
export const start = internalMutation({
	args: {
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("syncState", {
			organizationId: args.organizationId,
			syncType: args.syncType,
			tripletexEnv: args.tripletexEnv,
			status: "running",
			recordsProcessed: 0,
			recordsFailed: 0,
			startedAt: Date.now(),
		});
	},
});

/** Mark a sync run as completed successfully — internal only. */
export const complete = internalMutation({
	args: {
		syncStateId: v.id("syncState"),
		recordsProcessed: v.number(),
		recordsFailed: v.number(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		await ctx.db.patch(args.syncStateId, {
			status: "success",
			recordsProcessed: args.recordsProcessed,
			recordsFailed: args.recordsFailed,
			completedAt: now,
			lastSyncAt: now,
		});
	},
});

/** Mark a sync run as failed — internal only. */
export const fail = internalMutation({
	args: {
		syncStateId: v.id("syncState"),
		errorMessage: v.string(),
		recordsProcessed: v.optional(v.number()),
		recordsFailed: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.syncStateId, {
			status: "failed",
			errorMessage: args.errorMessage,
			completedAt: Date.now(),
			...(args.recordsProcessed !== undefined && {
				recordsProcessed: args.recordsProcessed,
			}),
			...(args.recordsFailed !== undefined && {
				recordsFailed: args.recordsFailed,
			}),
		});
	},
});
