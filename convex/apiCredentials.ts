import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { providerType, tripletexEnv } from "./validators";

/** List credentials for an organization (secrets are masked). */
export const list = query({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
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

/** Get unmasked credentials for internal use (sync actions). */
export const getForSync = query({
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

/** Get Rubic credentials for an org (Rubic has no environment distinction). */
export const getRubicCredentials = query({
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

/** Create or update API credentials. */
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

/** Delete API credentials. */
export const remove = mutation({
	args: { credentialId: v.id("apiCredentials") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.credentialId);
	},
});

/** Mark credentials as verified. */
export const markVerified = mutation({
	args: { credentialId: v.id("apiCredentials") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.credentialId, {
			lastVerifiedAt: Date.now(),
		});
	},
});
