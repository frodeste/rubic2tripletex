import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List invoice mappings for an org and environment (requires membership). */
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
			.query("invoiceMapping")
			.withIndex("by_org_and_env", (q) =>
				q.eq("organizationId", args.organizationId).eq("tripletexEnv", args.tripletexEnv),
			)
			.take(limit);
	},
});

/** List invoice mappings — internal only (used by sync actions). */
export const listInternal = internalQuery({
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

/** Get a specific invoice mapping by Rubic invoice ID — internal only. */
export const getByRubicId = internalQuery({
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

/** Get all unsynced payments for an org and environment — internal only. */
export const getUnsyncedPayments = internalQuery({
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

/** Create or update an invoice mapping — internal only (used by sync). */
export const upsert = internalMutation({
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

/** Mark an invoice's payment as synced — internal only (used by sync). */
export const markPaymentSynced = internalMutation({
	args: { invoiceMappingId: v.id("invoiceMapping") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.invoiceMappingId, {
			paymentSynced: true,
			lastSyncedAt: Date.now(),
		});
	},
});
