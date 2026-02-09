"use node";

/**
 * Public fetch action wrappers for department lookups.
 *
 * Split from syncPublic.ts to stay under TypeScript's type instantiation
 * depth limit (TS2589). These are read-only operations that only require
 * organization membership (viewers can use them).
 */

import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { tripletexEnv as tripletexEnvValidator } from "./validators";

/**
 * Verify the caller is authenticated and a member of the organization.
 * Works in action context (no ctx.db) by using ctx.runQuery.
 */
async function requireAuthAndMembership(
	ctx: Pick<GenericActionCtx<DataModel>, "auth" | "runQuery">,
	organizationId: Id<"organizations">,
) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error("Unauthenticated: you must be logged in to perform this action.");
	}

	const user = await ctx.runQuery(api.users.current, {});
	if (!user) {
		throw new Error("User record not found. Please reload the page.");
	}

	const membership = await ctx.runQuery(internal.organizations.checkMembership, {
		organizationId,
		userId: user._id,
	});
	if (!membership) {
		throw new Error("Forbidden: you are not a member of this organization.");
	}
	return { identity, user, membership };
}

export const fetchDepartmentsFromRubicPublic = action({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		await requireAuthAndMembership(ctx, args.organizationId);
		return ctx.runAction(internal.sync.fetchDepartmentsFromRubic, args);
	},
});

export const fetchDepartmentsFromTripletexPublic = action({
	args: {
		organizationId: v.id("organizations"),
		tripletexEnv: tripletexEnvValidator,
	},
	handler: async (ctx, args) => {
		await requireAuthAndMembership(ctx, args.organizationId);
		return ctx.runAction(internal.sync.fetchDepartmentsFromTripletex, args);
	},
});
