import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// authenticatedQuery / authenticatedMutation
// ---------------------------------------------------------------------------
// Ensures the caller is logged in AND has a `users` record in Convex.
// Injects `ctx.user` (the Convex user doc) and `ctx.identity`.
//
// For org-scoped authorization, use these builders together with
// `requireOrgMembership` / `requireOrgAdmin` from `convex/lib/auth.ts`
// inside the handler.
// ---------------------------------------------------------------------------

export const authenticatedQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated: you must be logged in.");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
			.unique();
		if (!user) {
			throw new Error("User record not found. Please reload the page.");
		}

		return { user, identity };
	}),
);

export const authenticatedMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthenticated: you must be logged in.");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
			.unique();
		if (!user) {
			throw new Error("User record not found. Please reload the page.");
		}

		return { user, identity };
	}),
);
