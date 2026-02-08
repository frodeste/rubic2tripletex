import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { tripletexEnv } from "./validators";

/** List invoice mappings for an org and environment. */
export const list = query({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnv,
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("invoiceMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.take(limit);
	},
});

/** Get a specific invoice mapping by Rubic invoice ID. */
export const getByRubicId = query({
	args: {
		organizationId: v.id("organizations"),
		rubicInvoiceId: v.number(),
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("invoiceMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicInvoiceId", args.rubicInvoiceId)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();
	},
});

/** Get all unsynced payments for an org and environment. */
export const getUnsyncedPayments = query({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnv,
	},
	handler: async (ctx, args) => {
		const all = await ctx.db
			.query("invoiceMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.collect();
		return all.filter((m) => !m.paymentSynced);
	},
});

/** Create or update an invoice mapping. */
export const upsert = mutation({
	args: {
		organizationId: v.id("organizations"),
		rubicInvoiceId: v.number(),
		tripletexEnv: tripletexEnv,
		rubicInvoiceNumber: v.number(),
		tripletexInvoiceId: v.number(),
		paymentSynced: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("invoiceMapping")
			.withIndex("by_org_rubic_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("rubicInvoiceId", args.rubicInvoiceId)
					.eq("tripletexEnv", args.tripletexEnv),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				rubicInvoiceNumber: args.rubicInvoiceNumber,
				tripletexInvoiceId: args.tripletexInvoiceId,
				paymentSynced: args.paymentSynced ?? existing.paymentSynced,
				lastSyncedAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("invoiceMapping", {
			organizationId: args.organizationId,
			rubicInvoiceId: args.rubicInvoiceId,
			tripletexEnv: args.tripletexEnv,
			rubicInvoiceNumber: args.rubicInvoiceNumber,
			tripletexInvoiceId: args.tripletexInvoiceId,
			lastSyncedAt: Date.now(),
			paymentSynced: args.paymentSynced ?? false,
		});
	},
});

/** Mark an invoice's payment as synced. */
export const markPaymentSynced = mutation({
	args: { invoiceMappingId: v.id("invoiceMapping") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.invoiceMappingId, {
			paymentSynced: true,
			lastSyncedAt: Date.now(),
		});
	},
});
