import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { syncType, tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List schedules for an organization (requires membership). */
export const list = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);
		return await ctx.db
			.query("integrationSchedules")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();
	},
});

/** Get all enabled schedules — internal only (used by cron dispatcher). */
export const listEnabled = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("integrationSchedules")
			.withIndex("by_enabled", (q) => q.eq("isEnabled", true))
			.collect();
	},
});

/** Create or update an integration schedule (requires membership). */
export const upsert = mutation({
	args: {
		organizationId: v.id("organizations"),
		syncType: syncType,
		tripletexEnv: tripletexEnv,
		cronExpression: v.string(),
		isEnabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		// Find existing schedule for this org + type + env
		const schedules = await ctx.db
			.query("integrationSchedules")
			.withIndex("by_org_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("syncType", args.syncType),
			)
			.collect();

		const existing = schedules.find((s) => s.tripletexEnv === args.tripletexEnv);

		if (existing) {
			await ctx.db.patch(existing._id, {
				cronExpression: args.cronExpression,
				isEnabled: args.isEnabled,
			});
			return existing._id;
		}

		return await ctx.db.insert("integrationSchedules", {
			organizationId: args.organizationId,
			syncType: args.syncType,
			tripletexEnv: args.tripletexEnv,
			cronExpression: args.cronExpression,
			isEnabled: args.isEnabled,
		});
	},
});

/** Mark a schedule as last run — internal only (used by scheduler). */
export const markScheduled = internalMutation({
	args: { scheduleId: v.id("integrationSchedules") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.scheduleId, {
			lastScheduledAt: Date.now(),
		});
	},
});

/** Mark a schedule's last completed time — internal only (used by scheduler). */
export const markCompleted = internalMutation({
	args: { scheduleId: v.id("integrationSchedules") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.scheduleId, {
			lastCompletedAt: Date.now(),
		});
	},
});
