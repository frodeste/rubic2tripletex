import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { providerType, tripletexEnv } from "./validators";
import { requireOrgMembership } from "./lib/auth";

/** List credentials for an organization (secrets are masked; requires membership). */
export const list = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const creds = await ctx.db
			.query("apiCredentials")
			.withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
			.collect();

		// Mask credentials in query results
		return creds.map((c) => ({
			...c,
			credentials: "********",
		}));
	},
});

/** Get unmasked credentials — internal only (used by sync actions). */
export const getForSync = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		provider: providerType,
		environment: tripletexEnv,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("apiCredentials")
			.withIndex("by_org_provider_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("provider", args.provider)
					.eq("environment", args.environment),
			)
			.unique();
	},
});

/** Get Rubic credentials — internal only (used by sync actions). */
export const getRubicCredentials = internalQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		// Rubic credentials are stored with environment "production" as default
		const creds = await ctx.db
			.query("apiCredentials")
			.withIndex("by_org_and_provider", (q) =>
				q.eq("organizationId", args.organizationId).eq("provider", "rubic"),
			)
			.first();
		return creds;
	},
});

/** Create or update API credentials (requires membership). */
export const upsert = mutation({
	args: {
		organizationId: v.id("organizations"),
		provider: providerType,
		environment: tripletexEnv,
		baseUrl: v.string(),
		credentials: v.string(),
		isEnabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		await requireOrgMembership(ctx, args.organizationId);

		const existing = await ctx.db
			.query("apiCredentials")
			.withIndex("by_org_provider_env", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("provider", args.provider)
					.eq("environment", args.environment),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				baseUrl: args.baseUrl,
				credentials: args.credentials,
				isEnabled: args.isEnabled,
			});
			return existing._id;
		}

		return await ctx.db.insert("apiCredentials", {
			organizationId: args.organizationId,
			provider: args.provider,
			environment: args.environment,
			baseUrl: args.baseUrl,
			credentials: args.credentials,
			isEnabled: args.isEnabled,
		});
	},
});

/** Delete API credentials (requires membership). */
export const remove = mutation({
	args: { credentialId: v.id("apiCredentials") },
	handler: async (ctx, args) => {
		// Look up the credential to find its org, then verify membership
		const cred = await ctx.db.get(args.credentialId);
		if (!cred) throw new Error("Credential not found");
		await requireOrgMembership(ctx, cred.organizationId);

		await ctx.db.delete(args.credentialId);
	},
});

/** Mark credentials as verified — internal only (used by sync actions). */
export const markVerified = internalMutation({
	args: { credentialId: v.id("apiCredentials") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.credentialId, {
			lastVerifiedAt: Date.now(),
		});
	},
});
